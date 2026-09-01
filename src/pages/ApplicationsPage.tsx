import { useMemo, useState, type FormEvent } from 'react';
import { api } from '../api';
import { EmptyState, PageHead, SupportTabs } from '../components/Common';
import { Modal } from '../components/Modal';
import { DateTimeInput } from '../components/DateTimeInput';
import type { Mutation } from '../hooks/useFolio';
import type { ApplicationPayload, ApplicationProcessStep, View, Workspace } from '../types';
import { applicationStatuses, dateLabel, dateTimeInputValue, getJob, nextProcesses, normalizedApplicationStatus, statusClass, todayDateTimeInputValue } from '../utils';

export function ApplicationsPage({ workspace, navigate, mutate }: { workspace: Workspace; navigate: (view: View) => void; mutate: Mutation }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [processSteps, setProcessSteps] = useState<ApplicationProcessStep[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('전체');
  const [sortBy, setSortBy] = useState<'recent' | 'deadline' | 'company'>('recent');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const editing = editingId ? workspace.applications.find((item) => item.id === editingId) : undefined;
  const editingJob = editing ? getJob(workspace, editing) : undefined;
  const visibleApplications = useMemo(() => workspace.applications.filter((application) => {
    const job = getJob(workspace, application);
    const matchesQuery = `${job.company} ${job.role}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    const matchesStatus = statusFilter === '전체' || normalizedApplicationStatus(application.status) === statusFilter;
    return matchesQuery && matchesStatus && (!pinnedOnly || application.pinned);
  }).sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    const aJob = getJob(workspace, a); const bJob = getJob(workspace, b);
    if (sortBy === 'company') return aJob.company.localeCompare(bJob.company, 'ko');
    if (sortBy === 'deadline') return (aJob.deadline || '9999').localeCompare(bJob.deadline || '9999');
    return (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '');
  }), [workspace, query, statusFilter, sortBy, pinnedOnly]);

  function open(id?: string) {
    const application = id ? workspace.applications.find((item) => item.id === id) : undefined;
    const legacyStep = application?.nextProcess || application?.next;
    setProcessSteps(application?.processSteps?.length ? application.processSteps : legacyStep ? [{ id: crypto.randomUUID(), name: legacyStep, date: application?.nextDate || todayDateTimeInputValue(), status: '예정' }] : []);
    setEditingId(id || null);
    setModalOpen(true);
  }

  function addProcessStep() {
    setProcessSteps((steps) => [...steps, { id: crypto.randomUUID(), name: '', date: todayDateTimeInputValue(), status: '예정' }]);
  }

  function openJobPage(jobId: string) {
    const url = new URL(window.location.href);
    url.searchParams.set('job', jobId);
    window.history.replaceState(null, '', url);
    navigate('jobs');
  }

  function updateProcessStep(id: string, patch: Partial<ApplicationProcessStep>) {
    setProcessSteps((steps) => steps.map((step) => step.id === id ? { ...step, ...patch } : step));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const savedSteps = processSteps.filter((step) => step.name.trim()).map((step) => ({ ...step, name: step.name.trim() }));
    const nextStep = savedSteps.find((step) => step.status === '진행 중') || savedSteps.find((step) => step.status === '예정');
    const payload: ApplicationPayload = {
      company: String(data.get('company')), role: String(data.get('role')), status: String(data.get('status')),
      appliedAt: String(data.get('appliedAt')), deadline: String(data.get('deadline')),
      nextProcess: nextStep?.name || '', nextDate: nextStep?.date || '', processSteps: savedSteps,
      next: nextStep?.name || '', url: String(data.get('url')), memo: String(data.get('memo'))
    };
    if (editing) await mutate('지원 수정', () => api.updateApplication(editing.id, payload));
    else await mutate('지원 추가', async () => {
      const created = await api.createApplication(payload);
      return api.updateApplication(created.id, {
        appliedAt: payload.appliedAt,
        nextProcess: payload.nextProcess,
        nextDate: payload.nextDate,
        processSteps: payload.processSteps,
        next: payload.nextProcess
      });
    });
    setModalOpen(false);
  }

  async function remove(id: string) {
    if (!window.confirm('이 지원 기록을 삭제할까요?')) return;
    await mutate('지원 삭제', () => api.deleteApplication(id));
    setModalOpen(false);
  }

  return <>
    <PageHead kicker="APPLICATIONS" title="지원 관리" description="작성 중인 서류부터 종료된 지원까지 모두 기록합니다." />
    <div className="view-actions"><SupportTabs active="applications" navigate={navigate} /><button className="button primary" onClick={() => open()}>+ 지원 추가</button></div>
    <div className="application-summary">{applicationStatuses.map((status) => <span key={status}><b>{workspace.applications.filter((item) => normalizedApplicationStatus(item.status) === status).length}</b>{status}</span>)}</div>
    <div className="application-toolbar">
      <label className="application-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="회사 또는 직무 검색" /></label>
      <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="지원 상태 필터"><option>전체</option>{applicationStatuses.map((status) => <option key={status}>{status}</option>)}</select>
      <select value={sortBy} onChange={(event) => setSortBy(event.target.value as 'recent' | 'deadline' | 'company')} aria-label="지원 정렬"><option value="recent">최근 수정순</option><option value="deadline">마감 임박순</option><option value="company">회사명순</option></select>
      <button className={`pin-filter ${pinnedOnly ? 'active' : ''}`} onClick={() => setPinnedOnly((value) => !value)}>★ 상단 고정만</button>
    </div>
    <div className="application-list">
      {visibleApplications.map((application) => {
        const job = getJob(workspace, application);
        return <article className="application-row" key={application.id}>
          <div className="app-company"><div className="company-logo">{job.company[0]}</div><div><strong>{job.company}</strong><small>{job.role}</small><button className="app-page-link" onClick={() => openJobPage(job.id)}>정리 페이지 열기 →</button></div></div>
          <span className={`status status-${statusClass(application.status)}`}>{normalizedApplicationStatus(application.status)}</span>
          <span className="app-next"><small>다음 프로세스</small><strong>{application.processSteps?.find((step) => step.status === '진행 중')?.name || application.processSteps?.find((step) => step.status === '예정')?.name || application.nextProcess || application.next || '미정'}</strong>{(application.processSteps?.find((step) => ['진행 중', '예정'].includes(step.status))?.date || application.nextDate) && <em>{dateLabel(application.processSteps?.find((step) => ['진행 중', '예정'].includes(step.status))?.date || application.nextDate)}</em>}</span>
          <span className="app-date"><small>접수 / 마감</small><span><i>접수</i>{dateLabel(application.appliedAt)}</span><span><i>마감</i>{dateLabel(job.deadline)}</span></span>
          <div className="app-controls"><select value={normalizedApplicationStatus(application.status)} onChange={(event) => void mutate('지원 상태 변경', () => api.updateApplication(application.id, { status: event.target.value })).catch(() => undefined)} aria-label="상태 변경">{applicationStatuses.map((status) => <option key={status}>{status}</option>)}</select><button className={`pin-button ${application.pinned ? 'active' : ''}`} onClick={() => void mutate(application.pinned ? '상단 고정 해제' : '상단 고정', () => api.updateApplication(application.id, { pinned: !application.pinned })).catch(() => undefined)} aria-label={application.pinned ? '상단 고정 해제' : '상단 고정'} title={application.pinned ? '상단 고정 해제' : '상단에 고정'}>★</button><button className="row-menu" onClick={() => open(application.id)} aria-label="지원 수정">✎</button></div>
        </article>;
      })}
      {!workspace.applications.length && <EmptyState title="아직 등록한 지원이 없습니다." description="회사와 직무, 현재 상태를 입력하면 지원 과정을 한곳에서 추적할 수 있습니다." action={<button className="button primary" onClick={() => open()}>첫 지원 추가</button>} />}
      {!!workspace.applications.length && !visibleApplications.length && <EmptyState title="조건에 맞는 지원이 없습니다." description="검색어나 필터를 바꿔 보세요." />}
    </div>
    {modalOpen && <Modal title={editing ? '지원 수정' : '지원 추가'} kicker="APPLICATION" onClose={() => setModalOpen(false)}><form key={editingId || 'new'} onSubmit={submit}>
      <div className="form-grid two"><label>회사명<input required name="company" defaultValue={editingJob?.company || ''} /></label><label>직무명<input required name="role" defaultValue={editingJob?.role || ''} /></label></div>
      <label>현재 상태<select name="status" defaultValue={normalizedApplicationStatus(editing?.status || '관심')}>{applicationStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
      <div className="form-section-label">지원 일정</div>
      <div className="form-grid two"><label>서류 접수 일시 (24시간)<DateTimeInput name="appliedAt" ariaLabel="서류 접수 일시" defaultValue={editing?.appliedAt || todayDateTimeInputValue()} /></label><label>서류 마감 일시 (24시간)<DateTimeInput name="deadline" ariaLabel="서류 마감 일시" defaultValue={editingJob?.deadline || todayDateTimeInputValue()} /></label></div>
      <div className="form-section-label process-section-head"><span>채용 프로세스</span><button type="button" className="text-button" onClick={addProcessStep}>+ 단계 추가</button></div>
      <p className="form-help">단계명은 직접 입력하거나 추천 항목에서 선택할 수 있습니다.</p>
      <datalist id="process-suggestions">{nextProcesses.map((process) => <option key={process} value={process} />)}</datalist>
      <div className="process-step-list">{processSteps.map((step, index) => <div className="process-step-row" key={step.id}>
        <span className="process-step-index">{index + 1}</span>
        <label>단계명<input aria-label={`${index + 1}번째 단계명`} list="process-suggestions" value={step.name} onChange={(event) => updateProcessStep(step.id, { name: event.target.value })} placeholder="예: 실무진 커피챗" /></label>
        <label>예정 일시 (24시간)<DateTimeInput ariaLabel={`${index + 1}번째 예정 일시`} value={dateTimeInputValue(step.date)} onChange={(value) => updateProcessStep(step.id, { date: value })} /></label>
        <label>진행 상태<select aria-label={`${index + 1}번째 진행 상태`} value={step.status} onChange={(event) => updateProcessStep(step.id, { status: event.target.value as ApplicationProcessStep['status'] })}><option>예정</option><option>진행 중</option><option>완료</option><option>취소</option></select></label>
        <button type="button" className="process-remove" aria-label={`${index + 1}번째 단계 삭제`} onClick={() => setProcessSteps((steps) => steps.filter((item) => item.id !== step.id))}>×</button>
      </div>)}</div>
      {!processSteps.length && <button type="button" className="process-empty" onClick={addProcessStep}>+ 첫 프로세스 단계 추가</button>}
      <label>공고 URL<input name="url" type="url" defaultValue={editingJob?.url || ''} placeholder="https://..." /></label>
      <label>메모<textarea name="memo" rows={4} defaultValue={editing?.memo || ''} placeholder="지원 과정에서 기억할 내용을 입력하세요." /></label>
      <div className="modal-actions application-modal-actions">{editing && <button type="button" className="button danger" onClick={() => void remove(editing.id)}>지원 삭제</button>}<span /><button type="button" className="button ghost" onClick={() => setModalOpen(false)}>취소</button><button className="button primary">저장</button></div>
    </form></Modal>}
  </>;
}
