import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '../api';
import { EmptyState, PageHead } from '../components/Common';
import { Modal } from '../components/Modal';
import type { Mutation } from '../hooks/useFolio';
import type { VaultNote, Workspace } from '../types';

export function VaultPage({ workspace, mutate }: { workspace: Workspace; mutate: Mutation }) {
  const [selectedId, setSelectedId] = useState(workspace.vaultNotes[0]?.id || '');
  const selected = workspace.vaultNotes.find((note) => note.id === selectedId) || workspace.vaultNotes[0];
  const [title, setTitle] = useState(selected?.title || '');
  const [content, setContent] = useState(selected?.content || '');
  const [creating, setCreating] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'waiting' | 'saving'>('saved');
  const editVersion = useRef(0);

  useEffect(() => {
    if (!selected || dirty) return;
    setSelectedId(selected.id);
    setTitle(selected.title);
    setContent(selected.content);
  }, [selected?.id, selected?.title, selected?.content, dirty]);

  useEffect(() => {
    if (!selected || !dirty) return;
    setSaveState('waiting');
    const version = editVersion.current;
    const timer = window.setTimeout(() => void save(version), 700);
    return () => window.clearTimeout(timer);
  }, [title, content, selected?.id, dirty]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const note = await mutate('메모 추가', () => api.createVaultNote({ title: String(data.get('title')), content: '' })) as VaultNote;
    setSelectedId(note.id);
    setCreating(false);
  }

  async function save(version = editVersion.current) {
    if (!selected) return;
    setSaveState('saving');
    await mutate('메모 저장', () => api.updateVaultNote(selected.id, { title, content }));
    if (editVersion.current === version) {
      setDirty(false);
      setSaveState('saved');
    }
  }

  function changeTitle(value: string) {
    editVersion.current += 1;
    setTitle(value);
    setDirty(true);
  }

  function changeContent(value: string) {
    editVersion.current += 1;
    setContent(value);
    setDirty(true);
  }

  async function selectNote(id: string) {
    if (dirty) await save();
    setSelectedId(id);
  }

  async function remove() {
    if (!selected || !window.confirm(`'${selected.title}' 메모를 삭제할까요?`)) return;
    await mutate('메모 삭제', () => api.deleteVaultNote(selected.id));
    setSelectedId('');
  }

  return <>
    <PageHead kicker="UNIVERSAL VAULT" title="통합 보관함" description="범용 프롬프트, 자주 쓰는 문구와 자유 메모를 한곳에 저장합니다." actions={<button className="button primary" onClick={() => setCreating(true)}>+ 새 메모</button>} />
    {workspace.vaultNotes.length ? <div className="vault-note-layout">
      <aside className="card vault-note-list"><div className="section-head"><h2>저장한 메모</h2><span>{workspace.vaultNotes.length}개</span></div>{workspace.vaultNotes.map((note) => <button className={note.id === selected?.id ? 'active' : ''} key={note.id} onClick={() => void selectNote(note.id)}><strong>{note.title}</strong><small>{note.content.trim().slice(0, 60) || '내용 없음'}</small></button>)}</aside>
      <article className="card vault-note-editor"><div className="vault-note-toolbar"><input aria-label="메모 제목" value={title} onChange={(event) => changeTitle(event.target.value)} placeholder="메모 제목" /><div><span className={`vault-save-state ${saveState}`}>{saveState === 'saving' ? '저장 중…' : saveState === 'waiting' ? '변경됨' : '자동 저장됨'}</span><button className="button ghost small" onClick={() => void remove()}>삭제</button></div></div><textarea value={content} onChange={(event) => changeContent(event.target.value)} placeholder="범용 프롬프트나 메모를 자유롭게 입력하세요." /><div className="word-count">{content.length}자 · 입력을 멈추면 자동 저장됩니다.</div></article>
    </div> : <EmptyState title="아직 저장한 메모가 없습니다." description="범용 프롬프트나 반복해서 사용하는 문구를 자유롭게 보관해 보세요." action={<button className="button primary" onClick={() => setCreating(true)}>첫 메모 만들기</button>} />}
    {creating && <Modal title="새 메모" kicker="UNIVERSAL VAULT" compact onClose={() => setCreating(false)}><form onSubmit={create}><label>제목<input name="title" required autoFocus placeholder="예: 범용 자기소개서 프롬프트" /></label><div className="modal-actions"><button type="button" className="button ghost" onClick={() => setCreating(false)}>취소</button><button className="button primary">만들기</button></div></form></Modal>}
  </>;
}
