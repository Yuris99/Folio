import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import { EmptyState, PageHead, SupportTabs } from '../components/Common';
import { Modal } from '../components/Modal';
import type { Mutation } from '../hooks/useFolio';
import type { SupportDocument, View, Workspace } from '../types';

export function DocumentsPage({ workspace, navigate, mutate }: { workspace: Workspace; navigate: (view: View) => void; mutate: Mutation }) {
  const [selectedId, setSelectedId] = useState(workspace.docs[0]?.id || '');
  const selected = workspace.docs.find((item) => item.id === selectedId) || workspace.docs[0];
  const [content, setContent] = useState(selected?.content || '');
  const [creating, setCreating] = useState(false);

  useEffect(() => { if (selected) { setSelectedId(selected.id); setContent(selected.content); } }, [selected?.id, selected?.content]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const document = await mutate('문서 생성', () => api.createDocument({ title: String(data.get('title')), jobId: String(data.get('jobId') || '') || undefined, content: '', citations: [], warnings: [] })) as SupportDocument;
    setSelectedId(document.id);
    setCreating(false);
  }

  async function save() {
    if (!selected) return;
    await mutate('문서 저장', () => api.saveDocument(selected.id, { ...selected, content }));
  }

  return <>
    <PageHead kicker="APPLICATION DOCUMENTS" title="지원 문서" description="회사별 자기소개서와 지원 문서를 확인하고 편집합니다." />
    <div className="view-actions"><SupportTabs active="documents" navigate={navigate} /><button className="button primary" onClick={() => setCreating(true)}>+ 문서 추가</button></div>
    {workspace.docs.length ? <div className="doc-layout">
      <aside className="card doc-list company-doc-list"><div className="section-head"><h2>회사별 문서</h2></div>{workspace.docs.map((document) => { const job = workspace.jobs.find((item) => item.id === document.jobId); const company = job?.company || document.title.split(' · ')[0]; return <button className={document.id === selected?.id ? 'active' : ''} key={document.id} onClick={() => setSelectedId(document.id)}><span className="company-logo">{company[0]}</span><span><strong>{company}</strong><small>{document.title.split(' · ')[1] || '지원 문서'}</small></span></button>; })}</aside>
      <article className="card editor"><div className="editor-toolbar"><div><p className="eyebrow">APPLICATION DOCUMENT</p><strong>{selected?.title}</strong></div><button className="button small" onClick={() => void save()}>저장</button></div><textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="문항의 핵심 메시지와 근거 경험을 작성하세요." /><div className="word-count">{content.length}자 · 저장 버튼을 누르면 NAS에 반영됩니다.</div></article>
    </div> : <EmptyState title="아직 지원 문서가 없습니다." description="ChatGPT 등에서 작성한 자기소개서를 회사별 문서로 저장하고 관리할 수 있습니다." action={<button className="button primary" onClick={() => setCreating(true)}>첫 문서 만들기</button>} />}
    {creating && <Modal title="지원 문서 추가" kicker="DOCUMENT" compact onClose={() => setCreating(false)}><form onSubmit={create}><label>문서 제목<input required name="title" placeholder="예: 네이버 · 프론트엔드 자기소개서" /></label><label>관련 회사<select name="jobId" defaultValue=""><option value="">회사 미지정</option>{workspace.jobs.map((job) => <option key={job.id} value={job.id}>{job.company} · {job.role}</option>)}</select></label><div className="modal-actions"><button type="button" className="button ghost" onClick={() => setCreating(false)}>취소</button><button className="button primary">만들기</button></div></form></Modal>}
  </>;
}
