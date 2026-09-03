import { useEffect, useState, type FormEvent } from 'react';
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

  useEffect(() => {
    if (!selected) return;
    setSelectedId(selected.id);
    setTitle(selected.title);
    setContent(selected.content);
  }, [selected?.id, selected?.title, selected?.content]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const note = await mutate('메모 추가', () => api.createVaultNote({ title: String(data.get('title')), content: '' })) as VaultNote;
    setSelectedId(note.id);
    setCreating(false);
  }

  async function save() {
    if (!selected) return;
    await mutate('메모 저장', () => api.updateVaultNote(selected.id, { title, content }));
  }

  async function remove() {
    if (!selected || !window.confirm(`'${selected.title}' 메모를 삭제할까요?`)) return;
    await mutate('메모 삭제', () => api.deleteVaultNote(selected.id));
    setSelectedId('');
  }

  return <>
    <PageHead kicker="UNIVERSAL VAULT" title="통합 보관함" description="범용 프롬프트, 자주 쓰는 문구와 자유 메모를 한곳에 저장합니다." actions={<button className="button primary" onClick={() => setCreating(true)}>+ 새 메모</button>} />
    {workspace.vaultNotes.length ? <div className="vault-note-layout">
      <aside className="card vault-note-list"><div className="section-head"><h2>저장한 메모</h2><span>{workspace.vaultNotes.length}개</span></div>{workspace.vaultNotes.map((note) => <button className={note.id === selected?.id ? 'active' : ''} key={note.id} onClick={() => setSelectedId(note.id)}><strong>{note.title}</strong><small>{note.content.trim().slice(0, 60) || '내용 없음'}</small></button>)}</aside>
      <article className="card vault-note-editor"><div className="vault-note-toolbar"><input aria-label="메모 제목" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="메모 제목" /><div><button className="button ghost small" onClick={() => void remove()}>삭제</button><button className="button primary small" onClick={() => void save()}>저장</button></div></div><textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="범용 프롬프트나 메모를 자유롭게 입력하세요." /><div className="word-count">{content.length}자 · 저장 버튼을 누르면 서버에 반영됩니다.</div></article>
    </div> : <EmptyState title="아직 저장한 메모가 없습니다." description="범용 프롬프트나 반복해서 사용하는 문구를 자유롭게 보관해 보세요." action={<button className="button primary" onClick={() => setCreating(true)}>첫 메모 만들기</button>} />}
    {creating && <Modal title="새 메모" kicker="UNIVERSAL VAULT" compact onClose={() => setCreating(false)}><form onSubmit={create}><label>제목<input name="title" required autoFocus placeholder="예: 범용 자기소개서 프롬프트" /></label><div className="modal-actions"><button type="button" className="button ghost" onClick={() => setCreating(false)}>취소</button><button className="button primary">만들기</button></div></form></Modal>}
  </>;
}
