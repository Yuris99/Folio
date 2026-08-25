import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent, type ReactNode } from 'react';
import { api } from '../api';
import type { Mutation } from '../hooks/useFolio';
import type { Attachment, Job, JobSubpage } from '../types';
import { dateLabel } from '../utils';

function findPage(pages: JobSubpage[], id: string): JobSubpage | undefined {
  for (const page of pages) {
    if (page.id === id) return page;
    const nested = findPage(page.children, id);
    if (nested) return nested;
  }
}

function updatePage(pages: JobSubpage[], id: string, patch: Partial<JobSubpage>): JobSubpage[] {
  return pages.map((page) => page.id === id ? { ...page, ...patch } : { ...page, children: updatePage(page.children, id, patch) });
}

function addChild(pages: JobSubpage[], parentId: string, child: JobSubpage): JobSubpage[] {
  if (!parentId) return [...pages, child];
  return pages.map((page) => page.id === parentId ? { ...page, children: [...page.children, child] } : { ...page, children: addChild(page.children, parentId, child) });
}

function removePage(pages: JobSubpage[], id: string): JobSubpage[] {
  return pages.filter((page) => page.id !== id).map((page) => ({ ...page, children: removePage(page.children, id) }));
}

function inlineMarkdown(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+]\(https?:\/\/[^)]+\))/g).filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)]\((https?:\/\/[^)]+)\)$/);
    if (link) return <a key={index} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
    return part;
  });
}

function Markdown({ source }: { source: string }) {
  const nodes: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => { if (list.length) { nodes.push(<ul key={`list-${nodes.length}`}>{list.map((item, index) => <li key={index}>{item}</li>)}</ul>); list = []; } };
  source.split('\n').forEach((raw, index) => {
    const line = raw.trim();
    const image = line.match(/^!\[(.*?)]\((https?:\/\/[^)]+|\/[^)]+)\)$/);
    const task = line.match(/^- \[([ xX])] (.*)$/);
    if (task) { flush(); nodes.push(<p className="md-task" key={index}>{task[1].trim() ? '☑' : '☐'} {task[2]}</p>); return; }
    if (line.startsWith('- ')) { list.push(line.slice(2)); return; }
    flush();
    if (!line) return nodes.push(<br key={index} />);
    if (image) return nodes.push(<figure key={index}><img src={image[2]} alt={image[1]} /><figcaption>{image[1]}</figcaption></figure>);
    if (line.startsWith('### ')) return nodes.push(<h3 key={index}>{inlineMarkdown(line.slice(4))}</h3>);
    if (line.startsWith('## ')) return nodes.push(<h2 key={index}>{inlineMarkdown(line.slice(3))}</h2>);
    if (line.startsWith('# ')) return nodes.push(<h1 key={index}>{inlineMarkdown(line.slice(2))}</h1>);
    if (line.startsWith('> ')) return nodes.push(<blockquote key={index}>{inlineMarkdown(line.slice(2))}</blockquote>);
    nodes.push(<p key={index}>{inlineMarkdown(line)}</p>);
  });
  flush();
  return <div className="markdown-preview">{nodes}</div>;
}

function PageTree({ pages, activeId, depth = 0, onSelect, onAdd }: { pages: JobSubpage[]; activeId: string; depth?: number; onSelect: (id: string) => void; onAdd: (parentId: string) => void }) {
  return <>{pages.map((page) => <div key={page.id}><div className={`job-tree-item ${activeId === page.id ? 'active' : ''}`} style={{ paddingLeft: 10 + depth * 14 }}><button onClick={() => onSelect(page.id)}><span>▤</span>{page.title || '제목 없음'}</button><button aria-label={`${page.title} 아래 페이지 추가`} onClick={() => onAdd(page.id)}>+</button></div><PageTree pages={page.children} activeId={activeId} depth={depth + 1} onSelect={onSelect} onAdd={onAdd} /></div>)}</>;
}

export function JobWorkspace({ job, attachments, mutate, onBack, onCreateApplication }: { job: Job; attachments: Attachment[]; mutate: Mutation; onBack: () => void; onCreateApplication: () => void }) {
  const [pages, setPages] = useState<JobSubpage[]>(job.pages || []);
  const [activeId, setActiveId] = useState('root');
  const [rootContent, setRootContent] = useState(job.pageContent || `# ${job.company} ${job.role}\n\n## 공고 메모\n\n${job.description || ''}`);
  const [coverImage, setCoverImage] = useState(job.coverImage || '');
  const [rootAttachmentIds, setRootAttachmentIds] = useState(job.attachmentIds || []);
  const [localAttachments, setLocalAttachments] = useState(attachments);
  const [preview, setPreview] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setPages(job.pages || []); setRootContent(job.pageContent || `# ${job.company} ${job.role}\n\n## 공고 메모\n\n${job.description || ''}`); setCoverImage(job.coverImage || ''); setRootAttachmentIds(job.attachmentIds || []); setLocalAttachments(attachments); }, [job.id, attachments]);
  const activePage = useMemo(() => activeId === 'root' ? undefined : findPage(pages, activeId), [pages, activeId]);
  const content = activePage?.content ?? rootContent;
  const pageCover = activePage?.coverImage ?? coverImage;
  const attachmentIds = activePage?.attachmentIds ?? rootAttachmentIds;

  function changeContent(value: string) {
    if (activeId === 'root') setRootContent(value);
    else setPages((items) => updatePage(items, activeId, { content: value, updatedAt: new Date().toISOString() }));
  }

  function createSubpage(parentId = '') {
    const page: JobSubpage = { id: crypto.randomUUID(), title: '새 페이지', content: '# 새 페이지\n\n내용을 입력하세요.', children: [], createdAt: new Date().toISOString() };
    setPages((items) => addChild(items, parentId === 'root' ? '' : parentId, page));
    setActiveId(page.id);
  }

  async function save() {
    await mutate('공고 페이지 저장', () => api.updateJob(job.id, { pageContent: rootContent, coverImage, pages, attachmentIds: rootAttachmentIds }));
  }

  function connectAttachment(id: string) {
    if (activeId === 'root') setRootAttachmentIds((ids) => [...new Set([...ids, id])]);
    else setPages((items) => updatePage(items, activeId, { attachmentIds: [...new Set([...(activePage?.attachmentIds || []), id])] }));
  }

  async function uploadFile(file?: File) {
    if (!file) return;
    if (!(file.type === 'application/pdf' || file.type.startsWith('image/')) || file.size > 5_000_000) return window.alert('5MB 이하 PDF 또는 이미지 파일만 올릴 수 있습니다.');
    const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
    const attachment = await mutate(file.type === 'application/pdf' ? 'PDF 업로드' : '이미지 업로드', () => api.uploadFile({ name: file.name, type: file.type, data }), false) as Attachment;
    setLocalAttachments((items) => [...items, attachment]);
    connectAttachment(attachment.id);
    if (file.type.startsWith('image/')) changeContent(`${content}${content.endsWith('\n') ? '' : '\n'}\n![${file.name}](${api.fileUrl(attachment.id)})\n`);
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    await uploadFile(event.target.files?.[0]);
    event.target.value = '';
  }

  async function pasteImage(event: ClipboardEvent<HTMLTextAreaElement>) {
    const image = Array.from(event.clipboardData.files).find((file) => file.type.startsWith('image/'));
    if (!image) return;
    event.preventDefault();
    const extension = image.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
    await uploadFile(new File([image], `붙여넣은-이미지-${Date.now()}.${extension}`, { type: image.type }));
  }

  function setCurrentCover(value: string) {
    if (activeId === 'root') setCoverImage(value);
    else setPages((items) => updatePage(items, activeId, { coverImage: value }));
  }

  function insertMarkdown(before: string, after = '', fallback = '텍스트') {
    const editor = editorRef.current;
    const start = editor?.selectionStart ?? content.length;
    const end = editor?.selectionEnd ?? content.length;
    const selected = content.slice(start, end) || fallback;
    changeContent(`${content.slice(0, start)}${before}${selected}${after}${content.slice(end)}`);
    requestAnimationFrame(() => { editorRef.current?.focus(); const cursor = start + before.length + selected.length + after.length; editorRef.current?.setSelectionRange(cursor, cursor); });
  }

  function insertTemplate() {
    const template = `# ${job.company} · ${job.role}\n\n## 한눈에 보기\n- 지원 마감: ${dateLabel(job.deadline)}\n- 공고 링크: ${job.url || '미등록'}\n- 현재 판단: \n\n## 주요 업무\n- \n\n## 자격 요건\n- \n\n## 우대 사항\n- \n\n## 나와의 연결점\n- [ ] 연결할 경험 정리\n- [ ] 강조할 기술 정리\n\n## 확인할 질문\n- \n\n## 면접 준비\n- [ ] 예상 질문 작성\n- [ ] 답변 근거 연결\n\n## 메모\n`;
    if (content.trim() && !window.confirm('현재 내용을 공고 정리 기본 양식으로 바꿀까요?')) return;
    changeContent(template);
  }

  return <div className="job-workspace">
    <aside className="job-page-tree"><button className="text-button" onClick={onBack}>← 공고 목록</button><div className={`job-tree-item root ${activeId === 'root' ? 'active' : ''}`}><button onClick={() => setActiveId('root')}><span>{job.company[0]}</span>{job.company}</button><button onClick={() => createSubpage('root')}>+</button></div><PageTree pages={pages} activeId={activeId} onSelect={setActiveId} onAdd={createSubpage} /><button className="job-add-page" onClick={() => createSubpage()}>+ 새 페이지</button></aside>
    <main className="job-page-editor">
      {pageCover && <div className="job-cover" style={{ backgroundImage: `url(${pageCover})` }}><button onClick={() => setCurrentCover('')}>커버 제거</button></div>}
      <div className="job-page-toolbar"><div><span className="eyebrow">{activeId === 'root' ? 'JOB WORKSPACE' : 'SUBPAGE'}</span>{activeId === 'root' ? <><h1>{job.company} · {job.role}</h1><p>{dateLabel(job.deadline)} 마감</p></> : <input className="job-page-title" value={activePage?.title || ''} onChange={(event) => setPages((items) => updatePage(items, activeId, { title: event.target.value }))} />}</div><div><button className="button small" onClick={() => setPreview((value) => !value)}>{preview ? '편집' : '미리보기'}</button><button className="button primary small" onClick={() => void save()}>저장</button></div></div>
      <div className="job-editor-actions"><label className="button small file-button">파일 업로드<input hidden type="file" accept="application/pdf,image/*" onChange={(event) => void chooseFile(event)} /></label><label>커버 URL<input value={pageCover} onChange={(event) => setCurrentCover(event.target.value)} placeholder="https://..." /></label>{activeId !== 'root' && <button className="text-button danger-text" onClick={() => { if (window.confirm('이 페이지와 하위 페이지를 삭제할까요?')) { setPages((items) => removePage(items, activeId)); setActiveId('root'); } }}>페이지 삭제</button>}<button className="text-button" onClick={() => createSubpage(activeId)}>+ 하위 페이지</button></div>
      {!preview && <div className="markdown-toolbar" aria-label="Markdown 서식 도구"><button onClick={() => insertMarkdown('## ', '', '제목')}>H2</button><button onClick={() => insertMarkdown('**', '**')}>B</button><button onClick={() => insertMarkdown('- ', '', '목록 항목')}>• 목록</button><button onClick={() => insertMarkdown('- [ ] ', '', '할 일')}>☐ 할 일</button><button onClick={() => insertMarkdown('> ', '', '인용문')}>❯ 인용</button><button onClick={() => insertMarkdown('[', '](https://)', '링크 이름')}>↗ 링크</button><button className="template-button" onClick={insertTemplate}>▤ 공고 정리 양식</button><span>Markdown 지원</span></div>}
      {preview ? <Markdown source={content} /> : <textarea ref={editorRef} className="job-markdown-editor" value={content} onChange={(event) => changeContent(event.target.value)} onPaste={(event) => void pasteImage(event)} placeholder="# 제목\n\nMarkdown으로 정리하세요. 캡처한 이미지는 여기에 바로 붙여넣을 수 있습니다." />}
      <section className="job-attachments"><div><strong>첨부 파일</strong><small>PDF와 이미지를 페이지별로 보관합니다.</small></div><div>{attachmentIds.map((id) => { const file = localAttachments.find((item) => item.id === id); return file ? <article key={id}><span>{file.type === 'application/pdf' ? 'PDF' : 'IMG'}</span><div><b>{file.name}</b><small>{Math.ceil(file.size / 1024)}KB</small></div><a href={api.fileUrl(file.id)} target="_blank" rel="noreferrer">열기</a><button onClick={() => activeId === 'root' ? setRootAttachmentIds((ids) => ids.filter((item) => item !== id)) : setPages((items) => updatePage(items, activeId, { attachmentIds: attachmentIds.filter((item) => item !== id) }))}>연결 해제</button></article> : null; })}{!attachmentIds.length && <p>첨부된 파일이 없습니다.</p>}</div></section>
      {activeId === 'root' && <div className="job-root-actions"><a className="button" href={job.url} target="_blank" rel="noreferrer">원본 공고 열기</a><button className="button primary" onClick={onCreateApplication}>지원 건 만들기</button></div>}
    </main>
  </div>;
}
