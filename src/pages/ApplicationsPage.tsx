import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { EmptyState, PageHead, SupportTabs } from '../components/Common';
import { Modal } from '../components/Modal';
import type { Mutation } from '../hooks/useFolio';
import type { ApplicationPayload, View, Workspace } from '../types';
import { applicationStatuses, dateLabel, getJob, statusClass } from '../utils';

export function ApplicationsPage({ workspace, navigate, mutate }: { workspace: Workspace; navigate: (view: View) => void; mutate: Mutation }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const editing = editingId ? workspace.applications.find((item) => item.id === editingId) : undefined;
  const editingJob = editing ? getJob(workspace, editing) : undefined;

  function open(id?: string) { setEditingId(id || null); setModalOpen(true); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload: ApplicationPayload = {
      company: String(data.get('company')), role: String(data.get('role')), status: String(data.get('status')),
      deadline: String(data.get('deadline')), next: String(data.get('next')), url: String(data.get('url')), memo: String(data.get('memo'))
    };
    if (editing) await mutate('지원 수정', () => api.updateApplication(editing.id, payload));
    else await mutate('지원 추가', () => api.createApplication(payload));
    setModalOpen(false);
  }

  async function remove(id: string) {
    if (!window.confirm('이 지원 기록을 삭제할까요?')) return;
    await mutate('지원 삭제', () => api.deleteApplication(id));
  }

  return <>
    <PageHead kicker="APPLICATIONS" title="지원 관리" description="작성 중인 서류부터 종료된 지원까지 모두 기록합니다." />
    <div className="view-actions"><SupportTabs active="applications" navigate={navigate} /><button className="button primary" onClick={() => open()}>+ 지원 추가</button></div>
    <div className="application-summary">{applicationStatuses.map((status) => <span key={status}><b>{workspace.applications.filter((item) => item.status === status).length}</b>{status}</span>)}</div>
    <div className="application-list">
      {workspace.applications.map((application) => {
        const job = getJob(workspace, application);
        return <article className="application-row" key={application.id}>
          <button className="app-company app-open" onClick={() => open(application.id)}><div className="company-logo">{job.company[0]}</div><div><strong>{job.company}</strong><small>{job.role}</small></div></button>
          <span className={`status status-${statusClass(application.status)}`}>{application.status}</span>
          <span className="app-next"><small>다음 할 일</small>{application.next || '미정'}</span>
          <span className="app-date"><small>마감일</small>{dateLabel(job.deadline)}</span>
          <div className="app-controls"><select value={application.status} onChange={(event) => void mutate('지원 상태 변경', () => api.updateApplication(application.id, { status: event.target.value })).catch(() => undefined)} aria-label="상태 변경">{applicationStatuses.map((status) => <option key={status}>{status}</option>)}</select><button className="row-menu" onClick={() => void remove(application.id)}>×</button></div>
        </article>;
      })}
      {!workspace.applications.length && <EmptyState title="아직 등록한 지원이 없습니다." description="회사와 직무, 현재 상태를 입력하면 지원 과정을 한곳에서 추적할 수 있습니다." action={<button className="button primary" onClick={() => open()}>첫 지원 추가</button>} />}
    </div>
    {modalOpen && <Modal title={editing ? '지원 수정' : '지원 추가'} kicker="APPLICATION" compact onClose={() => setModalOpen(false)}><form key={editingId || 'new'} onSubmit={submit}>
      <div className="form-grid two"><label>회사명<input required name="company" defaultValue={editingJob?.company || ''} /></label><label>직무명<input required name="role" defaultValue={editingJob?.role || ''} /></label></div>
      <div className="form-grid two"><label>현재 상태<select name="status" defaultValue={editing?.status || '관심'}>{applicationStatuses.map((status) => <option key={status}>{status}</option>)}</select></label><label>마감일<input name="deadline" type="date" defaultValue={editingJob?.deadline || ''} /></label></div>
      <label>다음 할 일<input name="next" defaultValue={editing?.next || ''} placeholder="예: 자기소개서 2번 문항 작성" /></label>
      <label>공고 URL<input name="url" type="url" defaultValue={editingJob?.url || ''} placeholder="https://..." /></label>
      <label>메모<textarea name="memo" rows={4} defaultValue={editing?.memo || ''} placeholder="지원 과정에서 기억할 내용을 입력하세요." /></label>
      <div className="modal-actions"><button type="button" className="button ghost" onClick={() => setModalOpen(false)}>취소</button><button className="button primary">저장</button></div>
    </form></Modal>}
  </>;
}
