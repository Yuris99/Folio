import { useMemo, useState, type FormEvent } from 'react';
import { api } from '../api';
import { EmptyState, PageHead, SupportTabs } from '../components/Common';
import { Modal } from '../components/Modal';
import { DateTimeInput } from '../components/DateTimeInput';
import { JobWorkspace } from '../components/JobWorkspace';
import type { Mutation } from '../hooks/useFolio';
import type { ApplicationPayload, ApplicationProcessStep, CareerGrade, View, Workspace } from '../types';
import { CAREER_GRADES, getPriorityBreakdown, getPriorityLabel, isClosedApplication, priorityClass } from '../priority';
import { applicationStatuses, dateLabel, dateTimeInputValue, getJob, nextProcesses, normalizedApplicationStatus, statusClass, todayDateTimeInputValue } from '../utils';

export function ApplicationsPage({ workspace, navigate, mutate }: { workspace: Workspace; navigate: (view: View) => void; mutate: Mutation }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [processSteps, setProcessSteps] = useState<ApplicationProcessStep[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('전체');
  const [gradeFilter, setGradeFilter] = useState('전체');
  const [priorityFilter, setPriorityFilter] = useState('전체');
  const [sortBy, setSortBy] = useState<'recent' | 'priority' | 'grade' | 'deadline' | 'company'>('priority');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [workspaceJobId, setWorkspaceJobId] = useState<string | null>(null);
  const [alwaysOpen, setAlwaysOpen] = useState(false);
  const editing = editingId ? workspace.applications.find((item) => item.id === editingId) : undefined;
  const editingJob = editing ? getJob(workspace, editing) : undefined;
  const visibleApplications = useMemo(() => workspace.applications.filter((application) => {
    const job = getJob(workspace, application);
    const matchesQuery = `${job.company} ${job.role} ${job.location || ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    const matchesStatus = statusFilter === '전체' || normalizedApplicationStatus(application.status) === statusFilter;
    const priority = getPriorityLabel(getPriorityBreakdown(application, job).final);
    const matchesGrade = gradeFilter === '전체' || application.careerGrade === gradeFilter;
    const matchesPriority = priorityFilter === '전체' || priority === priorityFilter;
    return matchesQuery && matchesStatus && matchesGrade && matchesPriority && (!pinnedOnly || application.pinned);
  }).sort((a, b) => {
    const closedOrder = Number(isClosedApplication(a.status)) - Number(isClosedApplication(b.status));
    if (closedOrder) return closedOrder;
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    const aJob = getJob(workspace, a); const bJob = getJob(workspace, b);
    if (sortBy === 'priority') { const score = getPriorityBreakdown(b, bJob).final - getPriorityBreakdown(a, aJob).final; if (score) return score; return (aJob.deadline || '9999').localeCompare(bJob.deadline || '9999'); }
    if (sortBy === 'grade') return (a.careerGrade ? CAREER_GRADES.indexOf(a.careerGrade) : 99) - (b.careerGrade ? CAREER_GRADES.indexOf(b.careerGrade) : 99);
    if (sortBy === 'company') return aJob.company.localeCompare(bJob.company, 'ko');
    if (sortBy === 'deadline') return (aJob.deadline || '9999').localeCompare(bJob.deadline || '9999');
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  }), [workspace, query, statusFilter, gradeFilter, priorityFilter, sortBy, pinnedOnly]);

  function open(id?: string) {
    const application = id ? workspace.applications.find((item) => item.id === id) : undefined;
    const legacyStep = application?.nextProcess || application?.next;
    setProcessSteps(application?.processSteps?.length ? application.processSteps : legacyStep ? [{ id: crypto.randomUUID(), name: legacyStep, date: application?.nextDate || todayDateTimeInputValue(), status: '예정' }] : []);
    setAlwaysOpen(Boolean(application && getJob(workspace, application).alwaysOpen));
    setEditingId(id || null);
    setModalOpen(true);
  }

  function addProcessStep() {
    setProcessSteps((steps) => [...steps, { id: crypto.randomUUID(), name: '', date: todayDateTimeInputValue(), status: '예정' }]);
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
      company: String(data.get('company')), role: String(data.get('role')), location: String(data.get('location')), status: String(data.get('status')),
      careerGrade: String(data.get('careerGrade')) as CareerGrade,
      applicationFitScore: Number(data.get('applicationFitScore') || 0), companyScore: Number(data.get('companyScore') || 0), locationScore: Number(data.get('locationScore') || 0), processScore: Number(data.get('processScore') || 0), priorityAdjustment: Number(data.get('priorityAdjustment') || 0),
      appliedAt: String(data.get('appliedAt')), deadline: alwaysOpen ? '' : String(data.get('deadline')), alwaysOpen,
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
      <select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)} aria-label="직무등급 필터"><option>전체</option>{CAREER_GRADES.map((grade) => <option key={grade}>{grade}</option>)}</select>
      <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} aria-label="우선순위 필터"><option>전체</option>{['최우선','적극 지원','지원 검토','후순위','낮음'].map((label) => <option key={label}>{label}</option>)}</select>
      <select className="application-sort" value={sortBy} onChange={(event) => setSortBy(event.target.value as 'recent' | 'priority' | 'grade' | 'deadline' | 'company')} aria-label="지원 정렬"><option value="priority">지원 우선순위 높은 순</option><option value="grade">직무등급 순</option><option value="deadline">마감 임박순</option><option value="recent">최근 추가순</option><option value="company">회사명순</option></select>
      <button className={`pin-filter ${pinnedOnly ? 'active' : ''}`} onClick={() => setPinnedOnly((value) => !value)}>★ 상단 고정만</button>
    </div>
    <div className="application-list">
      {visibleApplications.map((application) => {
        const job = getJob(workspace, application);
        const breakdown = getPriorityBreakdown(application, job), priorityLabel = getPriorityLabel(breakdown.final), closed = isClosedApplication(application.status);
        const scoreTitle = `직무 적합도 ${breakdown.career}/40 · 지원 적합성 ${breakdown.fit}/20 · 회사 ${breakdown.company}/15 · 지역 ${breakdown.location}/10 · 전형 ${breakdown.process}/10 · 마감 ${breakdown.deadline}/5 · 보정 ${breakdown.adjustment >= 0 ? '+' : ''}${breakdown.adjustment}`;
        return <article className={`application-row application-row-clickable priority-card-${priorityClass(breakdown.final)} ${closed ? 'application-closed' : ''}`} key={application.id} role="button" tabIndex={0} onClick={(event) => { if (!(event.target as HTMLElement).closest('button, a, select, input, textarea, label')) setWorkspaceJobId(job.id); }} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setWorkspaceJobId(job.id); } }}>
          <div className="app-company"><div className="company-logo">{job.company[0]}</div><div><strong>{job.company}</strong><small>{job.role}{job.location ? ` · ${job.location}` : ''}</small>{job.url ? <a className="app-page-link" href={job.url} target="_blank" rel="noreferrer">공고 홈페이지 ↗</a> : <span className="app-page-link disabled">공고 링크 없음</span>}</div></div>
          <div className="app-status-stack"><span className={`status status-${statusClass(application.status)}`}>{normalizedApplicationStatus(application.status)}</span><span className={`career-grade grade-${application.careerGrade || 'none'}`}>{application.careerGrade || '–'}</span><span className="priority-tooltip-wrap"><button type="button" className={`priority-score priority-${priorityClass(breakdown.final)}`} aria-describedby={`priority-${application.id}`}><b>{breakdown.final}</b> · {priorityLabel}</button><span className="priority-tooltip" id={`priority-${application.id}`} role="tooltip"><strong>지원 우선순위 {breakdown.final}점 · {priorityLabel}</strong>{scoreTitle}</span></span></div>
          <span className="app-next"><small>다음 프로세스</small><strong>{application.processSteps?.find((step) => step.status === '진행 중')?.name || application.processSteps?.find((step) => step.status === '예정')?.name || application.nextProcess || application.next || '미정'}</strong>{(application.processSteps?.find((step) => ['진행 중', '예정'].includes(step.status))?.date || application.nextDate) && <em>{dateLabel(application.processSteps?.find((step) => ['진행 중', '예정'].includes(step.status))?.date || application.nextDate)}</em>}</span>
          <span className="app-date"><small>접수 / 마감</small><span><i>접수</i>{dateLabel(application.appliedAt)}</span><span><i>마감</i>{job.alwaysOpen ? '상시' : dateLabel(job.deadline)}</span></span>
          <div className="app-controls"><select value={normalizedApplicationStatus(application.status)} onChange={(event) => void mutate('지원 상태 변경', () => api.updateApplication(application.id, { status: event.target.value })).catch(() => undefined)} aria-label="상태 변경">{applicationStatuses.map((status) => <option key={status}>{status}</option>)}</select><button className={`pin-button ${application.pinned ? 'active' : ''}`} onClick={() => void mutate(application.pinned ? '상단 고정 해제' : '상단 고정', () => api.updateApplication(application.id, { pinned: !application.pinned })).catch(() => undefined)} aria-label={application.pinned ? '상단 고정 해제' : '상단 고정'} title={application.pinned ? '상단 고정 해제' : '상단에 고정'}>★</button><button className="row-menu" onClick={() => open(application.id)} aria-label="지원 수정">✎</button></div>
        </article>;
      })}
      {!workspace.applications.length && <EmptyState title="아직 등록한 지원이 없습니다." description="회사와 직무, 현재 상태를 입력하면 지원 과정을 한곳에서 추적할 수 있습니다." action={<button className="button primary" onClick={() => open()}>첫 지원 추가</button>} />}
      {!!workspace.applications.length && !visibleApplications.length && <EmptyState title="조건에 맞는 지원이 없습니다." description="검색어나 필터를 바꿔 보세요." />}
    </div>
    {workspaceJobId && (() => { const job = workspace.jobs.find((item) => item.id === workspaceJobId); return job ? <Modal title={`${job.company} · ${job.role}`} kicker="JOB INFO & NOTES" wide onClose={() => setWorkspaceJobId(null)}><JobWorkspace job={job} attachments={workspace.attachments} mutate={mutate} onBack={() => setWorkspaceJobId(null)} /></Modal> : null; })()}
    {modalOpen && <Modal title={editing ? '지원 수정' : '지원 추가'} kicker="APPLICATION" onClose={() => setModalOpen(false)}><form className="application-form" key={editingId || 'new'} onSubmit={submit}>
      <datalist id="company-suggestions">{[...new Set(workspace.jobs.map((job) => job.company))].map((company) => <option key={company} value={company} />)}</datalist>
      <div className="form-grid two"><label>회사명<input required name="company" list="company-suggestions" defaultValue={editingJob?.company || ''} /></label><label>직무명<input required name="role" defaultValue={editingJob?.role || ''} /></label></div>
      <label>근무지역<input name="location" defaultValue={editingJob?.location || ''} placeholder="예: 서울 강남구 · 주 2회 재택" /></label>
      <div className="form-grid two"><label>현재 상태<select name="status" defaultValue={normalizedApplicationStatus(editing?.status || '관심')}>{applicationStatuses.map((status) => <option key={status}>{status}</option>)}</select></label><label>직무등급 <small>(직접 입력)</small><select name="careerGrade" defaultValue={editing?.careerGrade || ''}><option value="">선택 안 함</option>{CAREER_GRADES.map((grade) => <option key={grade}>{grade}</option>)}</select></label></div>
      <div className="form-section-label">지원 우선순위 점수</div>
      <p className="form-help">각 항목을 직접 평가하면 직무등급과 마감일을 포함해 100점 만점으로 자동 계산합니다.</p>
      <div className="priority-input-grid"><label>지원 적합성 <small>0~20 · 20 매우 높음</small><input type="number" name="applicationFitScore" min="0" max="20" defaultValue={editing?.applicationFitScore ?? 0} /></label><label>회사 매력도 <small>0~15 · 15 매우 높음</small><input type="number" name="companyScore" min="0" max="15" defaultValue={editing?.companyScore ?? 0} /></label><label>지역 선호도 <small>0~10 · 10 매우 선호</small><input type="number" name="locationScore" min="0" max="10" defaultValue={editing?.locationScore ?? 0} /></label><label>전형 적합도 <small>0~10 · 10 매우 유리</small><input type="number" name="processScore" min="0" max="10" defaultValue={editing?.processScore ?? 0} /></label><label>수동 보정 <small>-10~10 · 기본 0</small><input type="number" name="priorityAdjustment" min="-10" max="10" defaultValue={editing?.priorityAdjustment ?? 0} /></label></div>
      <div className="form-section-label">지원 일정</div>
      <label className="inline-check"><input type="checkbox" checked={alwaysOpen} onChange={(event) => setAlwaysOpen(event.target.checked)} /> 상시 채용 <small>마감일 없음 · 마감 우선순위 0점</small></label>
      <div className="form-grid two"><label>서류 접수 일시 (24시간)<DateTimeInput name="appliedAt" ariaLabel="서류 접수 일시" defaultValue={editing?.appliedAt || todayDateTimeInputValue()} /></label><label>서류 마감 일시 (24시간)<DateTimeInput name="deadline" ariaLabel="서류 마감 일시" defaultValue={editingJob?.deadline || todayDateTimeInputValue()} disabled={alwaysOpen} /></label></div>
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
