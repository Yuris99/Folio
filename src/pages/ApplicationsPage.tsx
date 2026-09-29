import { DateInput } from '../components/DateInput';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api } from '../api';
import { EmptyState, PageHead, SupportTabs } from '../components/Common';
import { Modal } from '../components/Modal';
import { DateTimeInput } from '../components/DateTimeInput';
import { DeadlineCountdown } from '../components/DeadlineCountdown';
import { Icon } from '../components/Icon';
import { JobLinks } from '../components/JobLinks';
import { PriorityEditor, type PriorityInput } from '../components/PriorityEditor';
import { JobWorkspace } from '../components/JobWorkspace';
import type { Mutation } from '../hooks/useFolio';
import type { ApplicationPayload, ApplicationProcessStep, DocumentResult, View, Workspace } from '../types';
import { CAREER_GRADES, PRIORITY_CRITERIA, getPriorityBreakdown, priorityLevels, getPriorityLabel, isClosedApplication, priorityClass } from '../priority';
import { statsApplications, applicationStats, applicationDeadlineForSort, currentProcessStep, processStageGroup, processStageGroups, type ProcessStageGroup, isRejected, isSubmitted, matchesApplicationTab, applicationStatuses, dateLabel, dateTimeInputValue, daysUntil, getJob, nextProcesses, normalizedApplicationStatus, statusClass, todayDateTimeInputValue } from '../utils';

const STEP_STATUS_CYCLE: ApplicationProcessStep['status'][] = ['예정', '진행 중', '완료'];
const nextStepStatus = (status: ApplicationProcessStep['status']) => STEP_STATUS_CYCLE[(STEP_STATUS_CYCLE.indexOf(status) + 1) % STEP_STATUS_CYCLE.length];
const documentResultClass = (result?: DocumentResult) => result === '합격' ? 'pass' : result === '불합격' ? 'fail' : 'pending';
const processStepClass = (status: ApplicationProcessStep['status']) => ({ '예정': 'planned', '진행 중': 'active', '완료': 'done', '취소': 'cancelled' })[status];

export function ApplicationsPage({ workspace, navigate, mutate }: { workspace: Workspace; navigate: (view: View) => void; mutate: Mutation }) {
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [processSteps, setProcessSteps] = useState<ApplicationProcessStep[]>([]);
  const [query, setQuery] = useState('');
  const [editStatus, setEditStatus] = useState('관심');
  const [rejectId, setRejectId] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSaving, setRejectSaving] = useState(false);
  // 불합격한 단계: 'documents'(서류) · 단계 id · ''(기록 안 함)
  const [rejectStage, setRejectStage] = useState('');
  const [calendarWarning, setCalendarWarning] = useState('');
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const [statusFilter, setStatusFilter] = useState(() => new URLSearchParams(window.location.search).get('status') || '전체');
  const [gradeFilter, setGradeFilter] = useState('전체');
  const [priorityFilter, setPriorityFilter] = useState('전체');
  const [sortBy, setSortBy] = useState<'recent' | 'priority' | 'grade' | 'deadline' | 'company'>(() => { const value = new URLSearchParams(window.location.search).get('sort'); return ['recent', 'priority', 'grade', 'deadline', 'company'].includes(value || '') ? value as 'recent' | 'priority' | 'grade' | 'deadline' | 'company' : 'deadline'; });
  const [pinFirst, setPinFirst] = useState(true);
  const [consideringOnly, setConsideringOnly] = useState(false);
  const [workspaceJobId, setWorkspaceJobId] = useState<string | null>(null);
  const [alwaysOpen, setAlwaysOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [expandedStepId, setExpandedStepId] = useState('');
  const [documentResult, setDocumentResult] = useState<DocumentResult>('');
  const [priorityInput, setPriorityInput] = useState<PriorityInput>({ careerGrade: '', careerLevel: 0, compensationLevel: 0, passLevel: 0, workLevel: 0 });
  const editing = editingId ? workspace.applications.find((item) => item.id === editingId) : undefined;
  // 서합율: 서류 결과를 기록한 원서 중 합격 비율. 공고보관함으로 옮긴 지원은 뺍니다.
  const docStats = useMemo(() => applicationStats(statsApplications(workspace)), [workspace]);
  const docDecided = docStats.passed + docStats.failed;
  const statusCounts = useMemo(() => Object.fromEntries(applicationStatuses.map((status) => [status, workspace.applications.filter((item) => normalizedApplicationStatus(item.status) === status).length])), [workspace.applications]);
  const activeFilterCount = [gradeFilter !== '전체', priorityFilter !== '전체', consideringOnly].filter(Boolean).length;
  // 전형 진행은 상태를 늘리지 않고, 지금 단계 이름으로 묶어서 한 번 더 거릅니다.
  const [stageFilter, setStageFilter] = useState<ProcessStageGroup | ''>('');
  const stageCounts = useMemo(() => {
    const counts = new Map<ProcessStageGroup, number>();
    for (const application of workspace.applications) if (normalizedApplicationStatus(application.status) === '전형 진행') { const group = processStageGroup(application); counts.set(group, (counts.get(group) || 0) + 1); }
    return processStageGroups.filter((group) => counts.get(group)).map((group) => ({ group, count: counts.get(group)! }));
  }, [workspace.applications]);
  const editingJob = editing ? getJob(workspace, editing) : undefined;
  const visibleApplications = useMemo(() => workspace.applications.filter((application) => {
    const job = getJob(workspace, application);
    const matchesQuery = `${job.company} ${job.role} ${job.location || ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    const matchesStatus = matchesApplicationTab(application.status, statusFilter);
    const priority = getPriorityLabel(getPriorityBreakdown(application, job).final);
    const matchesGrade = gradeFilter === '전체' || application.careerGrade === gradeFilter;
    const matchesPriority = priorityFilter === '전체' || priority === priorityFilter;
    const matchesStage = statusFilter !== '전형 진행' || !stageFilter || processStageGroup(application) === stageFilter;
    return matchesQuery && matchesStatus && matchesStage && matchesGrade && matchesPriority && (!consideringOnly || application.considering);
  }).sort((a, b) => {
    const closedOrder = Number(isClosedApplication(a.status)) - Number(isClosedApplication(b.status));
    if (closedOrder) return closedOrder;
    if (sortBy !== 'deadline' && pinFirst && Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    const aJob = getJob(workspace, a); const bJob = getJob(workspace, b);
    if (sortBy === 'priority') { const score = getPriorityBreakdown(b, bJob).sortScore - getPriorityBreakdown(a, aJob).sortScore; if (score) return score; return (aJob.deadline || '9999').localeCompare(bJob.deadline || '9999'); }
    if (sortBy === 'grade') return (a.careerGrade ? CAREER_GRADES.indexOf(a.careerGrade) : 99) - (b.careerGrade ? CAREER_GRADES.indexOf(b.careerGrade) : 99);
    if (sortBy === 'company') return aJob.company.localeCompare(bJob.company, 'ko');
    if (sortBy === 'deadline') {
      const aDeadline = applicationDeadlineForSort(a, aJob);
      const bDeadline = applicationDeadlineForSort(b, bJob);
      return aDeadline < bDeadline ? -1 : aDeadline > bDeadline ? 1 : 0;
    }
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  }), [workspace, query, statusFilter, stageFilter, gradeFilter, priorityFilter, sortBy, pinFirst, consideringOnly]);

  function changeStatusFilter(status: string) {
    setStatusFilter(status);
    setStageFilter('');
    if (status === '지원 준비') setSortBy('deadline');
  }

  function open(id?: string) {
    const application = id ? workspace.applications.find((item) => item.id === id) : undefined;
    const legacyStep = application?.nextProcess || application?.next;
    const applicationJob = application ? getJob(workspace, application) : undefined;
    setProcessSteps(application?.processSteps?.length ? application.processSteps : legacyStep ? [{ id: crypto.randomUUID(), name: legacyStep, date: application?.nextDate || todayDateTimeInputValue(), status: '예정' }] : [{ id: crypto.randomUUID(), name: '서류 마감', date: applicationJob?.deadline || todayDateTimeInputValue(), status: '예정' }]);
    setAlwaysOpen(Boolean(application && getJob(workspace, application).alwaysOpen));
    setEditStatus(normalizedApplicationStatus(application?.status || '관심'));
    setEditingId(id || null);
    setExpandedStepId('');
    setDocumentResult(application?.documentResult || '');
    // 예전 숫자 점수는 5단계로 옮겨 보여 주고, 저장하면 새 값으로 기록됩니다.
    const levels = application ? priorityLevels(application) : undefined;
    setPriorityInput({ careerGrade: application?.careerGrade || '', careerLevel: levels?.career || 0, compensationLevel: levels?.compensation || 0, passLevel: levels?.pass || 0, workLevel: levels?.work || 0 });
    setModalOpen(true);
  }

  function addProcessStep(name = '') {
    const id = crypto.randomUUID();
    setProcessSteps((steps) => [...steps, { id, name, date: '', dateTbd: true, status: '예정' }]);
    setExpandedStepId(id);
  }

  function updateProcessStep(id: string, patch: Partial<ApplicationProcessStep>) {
    setProcessSteps((steps) => steps.map((step) => step.id === id ? { ...step, ...patch } : step));
  }

  function setStepResult(step: ApplicationProcessStep, result: DocumentResult) {
    // 결과가 나온 단계는 완료로 넘기고, 서류 단계 결과는 서합율용 서류 결과에도 반영합니다.
    updateProcessStep(step.id, result ? { result, status: '완료' } : { result });
    if (step.name.includes('서류')) setDocumentResult(result);
  }

  function moveProcessStep(index: number, direction: -1 | 1) {
    setProcessSteps((steps) => {
      const target = index + direction;
      if (target < 0 || target >= steps.length) return steps;
      const reordered = [...steps];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
      return reordered;
    });
  }

  function addProcessTodo(stepId: string) {
    setProcessSteps((steps) => steps.map((step) => step.id === stepId ? { ...step, todos: [...(step.todos || []), { id: crypto.randomUUID(), text: '', done: false }] } : step));
  }

  function updateProcessTodo(stepId: string, todoId: string, patch: { text?: string; done?: boolean }) {
    setProcessSteps((steps) => steps.map((step) => step.id === stepId ? { ...step, todos: (step.todos || []).map((todo) => todo.id === todoId ? { ...todo, ...patch } : todo) } : step));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const deadline = alwaysOpen ? '' : String(data.get('deadline'));
    const savedSteps = processSteps.filter((step) => step.name.trim()).map((step, index) => ({ ...step, name: step.name.trim(), date: index === 0 && step.name.trim() === '서류 마감' ? deadline : step.date, dateTbd: index === 0 && step.name.trim() === '서류 마감' ? !deadline : step.dateTbd, todos: (step.todos || []).filter((todo) => todo.text.trim()).map((todo) => ({ ...todo, text: todo.text.trim() })) }));
    const nextStep = savedSteps.find((step) => step.status === '진행 중') || savedSteps.find((step) => step.status === '예정');
    const payload: ApplicationPayload = {
      company: String(data.get('company')), role: String(data.get('role')), location: String(data.get('location')), status: String(data.get('status')),
      considering: data.get('considering') === 'on',
      careerGrade: priorityInput.careerGrade || undefined,
      careerLevel: priorityInput.careerLevel, compensationLevel: priorityInput.compensationLevel, passLevel: priorityInput.passLevel, workLevel: priorityInput.workLevel,
      // 예전 숫자 점수는 비워서 새 5단계 값만 쓰게 합니다.
      applicationFitScore: 0, compensationScore: 0, companyScore: 0, locationScore: 0, processScore: 0,
      appliedAt: String(data.get('appliedAt')), deadline, alwaysOpen,
      nextProcess: nextStep?.name || '', nextDate: nextStep?.date || '', processSteps: savedSteps,
      next: nextStep?.name || '', url: String(data.get('url')), notionUrl: String(data.get('notionUrl') || '').trim(), memo: String(data.get('memo')), documentResult: isSubmitted({ id: '', jobId: '', next: '', status: String(data.get('status')) }) ? documentResult : editing?.documentResult || '', rejectionReason: String(data.get('rejectionReason') ?? editing?.rejectionReason ?? '')
    };
    if (editing) await mutate('지원 수정', () => api.updateApplication(editing.id, payload));
    else await mutate('지원 추가', async () => {
      const created = await api.createApplication(payload);
      return api.updateApplication(created.id, {
        appliedAt: payload.appliedAt,
        nextProcess: payload.nextProcess,
        nextDate: payload.nextDate,
        processSteps: payload.processSteps,
        documentResult: payload.documentResult,
        next: payload.nextProcess
      });
    });
    await syncCalendarAfterStatusChange();
    setModalOpen(false);
  }

  async function syncCalendarAfterStatusChange() {
    setCalendarWarning('');
    try {
      const connection = await api.calendarStatus();
      if (!connection.connected) return;
      const result = await api.syncGoogleCalendar();
      if (result.failed) setCalendarWarning('지원 상태는 저장했지만 일부 Google Calendar 일정을 정리하지 못했습니다. 일정 화면에서 다시 동기화해 주세요.');
    } catch { setCalendarWarning('지원 상태는 저장했지만 Google Calendar 동기화에 실패했습니다. 일정 화면에서 다시 동기화해 주세요.'); }
  }

  function openRejection(id: string) {
    const application = workspace.applications.find((item) => item.id === id);
    setRejectId(id);
    setRejectReason(application?.rejectionReason || '');
    const current = application ? currentProcessStep(application) : undefined;
    setRejectStage(application?.documentResult !== '합격' ? 'documents' : current && !current.name.includes('서류') ? current.id : '');
  }

  // 서류가 아닌, 취소되지 않은 단계만 '어느 단계에서 떨어졌나요?' 선택지로 보여 줍니다.
  const rejectApplication = rejectId ? workspace.applications.find((item) => item.id === rejectId) : undefined;
  const rejectStageOptions = [
    { value: 'documents', label: '서류' },
    ...(rejectApplication?.processSteps || []).filter((step) => step.status !== '취소' && !step.name.includes('서류') && step.name.trim()).map((step) => ({ value: step.id, label: step.name })),
    { value: '', label: '기록 안 함' }
  ];

  // 고른 단계에 불합격, 그 앞 단계 중 결과가 비어 있는 곳에는 합격을 기록합니다.
  function rejectionResult(application: typeof rejectApplication): Pick<ApplicationPayload, 'documentResult' | 'processSteps'> {
    const steps = application?.processSteps || [];
    if (rejectStage === 'documents') {
      const documentIndex = steps.map((step) => step.status !== '취소' && step.name.includes('서류')).lastIndexOf(true);
      return { documentResult: '불합격', processSteps: steps.map((step, index) => index === documentIndex ? { ...step, result: '불합격', status: '완료' } : step) };
    }
    const failedIndex = steps.findIndex((step) => step.id === rejectStage);
    if (failedIndex < 0) return { documentResult: application?.documentResult || '', processSteps: steps };
    return {
      documentResult: '합격',
      processSteps: steps.map((step, index) => index === failedIndex ? { ...step, result: '불합격', status: '완료' } : index < failedIndex && step.status !== '취소' && !step.result ? { ...step, result: '합격', status: '완료' } : step)
    };
  }

  async function changeApplicationStatus(id: string, status: string) {
    if (isRejected(status)) { openRejection(id); return; }
    await mutate('지원 상태 변경', () => api.updateApplication(id, { status }));
    await syncCalendarAfterStatusChange();
  }

  async function saveRejection() {
    setRejectSaving(true);
    try {
      await mutate('불합격 사유 저장', () => api.updateApplication(rejectId, { status: '불합격', rejectionReason: rejectReason.trim(), ...rejectionResult(rejectApplication) }));
      setRejectId('');
      await syncCalendarAfterStatusChange();
    } catch { /* The mutation error is shown by the layout; keep the memo open. */ }
    finally { setRejectSaving(false); }
  }

  async function remove(id: string) {
    await mutate('공고보관함으로 이동', () => api.deleteApplication(id));
    await syncCalendarAfterStatusChange();
    setModalOpen(false);
  }

  return <>
    <PageHead kicker="APPLICATIONS" title="지원 관리" description="작성 중인 서류부터 종료된 지원까지 모두 기록합니다." />
    {calendarWarning && <p className="calendar-sync-state error" role="status">{calendarWarning}</p>}
    {rejectId && <Modal title="불합격 사유" kicker="APPLICATION RESULT" onClose={() => { if (!rejectSaving) setRejectId(''); }}><form onSubmit={(event) => { event.preventDefault(); void saveRejection(); }}><label>사유 메모 (선택)<textarea autoFocus rows={5} value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="안내받은 사유나 다음 지원에 참고할 내용을 적어 주세요." /></label><fieldset className="reject-stage"><legend>어느 단계에서 불합격했나요?</legend><div>{rejectStageOptions.map((option) => <label key={option.value || 'none'} className={rejectStage === option.value ? 'active' : ''}><input type="radio" name="rejectStage" checked={rejectStage === option.value} onChange={() => setRejectStage(option.value)} />{option.label}</label>)}</div><small>{rejectStage ? '고른 단계에 불합격, 그 앞 단계에는 합격이 기록돼 통계에 반영돼요.' : '단계별 통과율에는 반영되지 않아요.'}</small></fieldset><p className="empty-note">불합격 탭에만 표시되며 관련 일정과 할 일은 숨겨집니다.</p><div className="modal-actions"><button type="button" className="button ghost" disabled={rejectSaving} onClick={() => setRejectId('')}>취소</button><button className="button primary" disabled={rejectSaving}>{rejectSaving ? '저장 중…' : '불합격으로 저장'}</button></div></form></Modal>}
    <div className="view-actions"><SupportTabs active="applications" navigate={navigate} /><div className="view-actions-buttons"><button className="button ghost" onClick={() => navigate('jobs')}>공고보관함</button><button className="button primary" onClick={() => open()}><Icon name="plus" size={16} />지원 추가</button></div></div>
    <section className="app-overview" aria-label="지원 요약">
      <button type="button" className="app-pass-rate" onClick={() => navigate('stats')} title="통계에서 자세히 보기">
        <span className="app-pass-label">서류 합격률</span>
        <strong>{docStats.passRate === null ? '–' : docStats.passRate}<small>{docStats.passRate === null ? '' : '%'}</small></strong>
        <span className="app-pass-bar" aria-hidden="true">{docStats.passed > 0 && <i className="pass" style={{ flexGrow: docStats.passed }} />}{docStats.failed > 0 && <i className="fail" style={{ flexGrow: docStats.failed }} />}{docStats.pending > 0 && <i className="pending" style={{ flexGrow: docStats.pending }} />}</span>
        <span className="app-pass-detail">{docStats.submitted ? <>제출 {docStats.submitted} · <em className="pass">합격 {docStats.passed}</em> · <em className="fail">탈락 {docStats.failed}</em> · 대기 {docStats.pending}</> : '원서를 제출하면 계산돼요'}</span>
        {docDecided === 0 && docStats.submitted > 0 && <span className="app-pass-hint">서류 결과를 기록하면 계산돼요</span>}
      </button>
      <div className="app-status-tabs" role="tablist" aria-label="지원 상태">
        {['전체', ...applicationStatuses].map((status) => <button type="button" role="tab" aria-selected={statusFilter === status} className={`${statusFilter === status ? 'active' : ''} ${status === '불합격' ? 'rejected' : ''}`} key={status} onClick={() => changeStatusFilter(status)}><b>{status === '전체' ? workspace.applications.length : statusCounts[status]}</b><span>{status}</span></button>)}
      </div>
    </section>
    {statusFilter === '전형 진행' && stageCounts.length > 1 && <div className="app-stage-chips" role="group" aria-label="전형 단계">
      <button type="button" className={!stageFilter ? 'active' : ''} onClick={() => setStageFilter('')}>전체 <b>{statusCounts['전형 진행']}</b></button>
      {stageCounts.map(({ group, count }) => <button type="button" key={group} className={stageFilter === group ? 'active' : ''} onClick={() => setStageFilter(stageFilter === group ? '' : group)}>{group} <b>{count}</b></button>)}
    </div>}
    <div className="app-toolbar">
      <label className="app-search"><Icon name="search" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="회사 또는 직무 검색" /></label>
      <select className="app-sort" value={sortBy} onChange={(event) => setSortBy(event.target.value as 'recent' | 'priority' | 'grade' | 'deadline' | 'company')} aria-label="지원 정렬"><option value="priority">우선순위순</option><option value="deadline">마감 임박순</option><option value="grade">직무선호도순</option><option value="recent">최근 추가순</option><option value="company">회사명순</option></select>
      <button type="button" className={`app-filter-toggle ${mobileFiltersOpen || activeFilterCount ? 'active' : ''}`} aria-expanded={mobileFiltersOpen} onClick={() => setMobileFiltersOpen((value) => !value)}><Icon name="sliders" size={16} />필터{activeFilterCount > 0 && <b>{activeFilterCount}</b>}</button>
    </div>
    {mobileFiltersOpen && <div className="app-filter-panel">
      <label>직무선호도<select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)}><option>전체</option>{CAREER_GRADES.map((grade) => <option key={grade}>{grade}</option>)}</select></label>
      <label>우선순위<select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option>전체</option>{['최우선', '적극 지원', '지원 검토', '후순위', '낮음'].map((label) => <option key={label}>{label}</option>)}</select></label>
      <label className="inline-check"><input type="checkbox" checked={consideringOnly} onChange={(event) => setConsideringOnly(event.target.checked)} />고민 중인 공고만</label>
      {sortBy !== 'deadline' && <label className="inline-check"><input type="checkbox" checked={pinFirst} onChange={(event) => setPinFirst(event.target.checked)} />고정한 지원 먼저</label>}
      {activeFilterCount > 0 && <button type="button" className="text-button" onClick={() => { setGradeFilter('전체'); setPriorityFilter('전체'); setConsideringOnly(false); }}>필터 초기화</button>}
    </div>}
    <div className="app-list">
      {visibleApplications.map((application) => {
        const job = getJob(workspace, application);
        const breakdown = getPriorityBreakdown(application, job), priorityLabel = getPriorityLabel(breakdown.final), closed = isClosedApplication(application.status);
        const deadlineDays = job.deadline ? daysUntil(job.deadline, new Date(currentTime)) : null;
        const normalizedStatus = normalizedApplicationStatus(application.status);
        const processStepsForProgress = application.processSteps || [];
        const completedSteps = processStepsForProgress.filter((step) => step.status === '완료').length;
        const processProgress = processStepsForProgress.length ? Math.round((completedSteps / processStepsForProgress.length) * 100) : 0;
        const activeProcessStep = processStepsForProgress.find((step) => step.status === '진행 중') || processStepsForProgress.find((step) => step.status === '예정');
        const legacyProcessDate = processStepsForProgress.length ? '' : application.nextDate;
        const activeProcessDate = activeProcessStep?.dateTbd ? '' : activeProcessStep?.date || legacyProcessDate;
        const activeProcessDateLabel = activeProcessStep?.dateTbd
          ? '날짜 미정'
          : activeProcessStep?.timeTbd && activeProcessDate
            ? `${dateLabel(activeProcessDate)} · 시간 미정`
            : activeProcessDate ? dateLabel(activeProcessDate) : '';
        const processDays = activeProcessDate ? daysUntil(activeProcessDate, new Date(currentTime)) : null;
        const scoreTitle = `${PRIORITY_CRITERIA.map((criterion) => `${criterion.label} ${breakdown.points[criterion.key]}/${criterion.weight}${breakdown.levels[criterion.key] ? '' : '(미입력)'}`).join(' · ')}${breakdown.deadline ? ` · 마감 보너스 +${breakdown.deadline}` : ''}`;
        const nextLabel = activeProcessStep?.name || application.nextProcess || application.next || '미정';
        const urgentDeadline = deadlineDays !== null && deadlineDays <= 3 && deadlineDays >= 0;
        return <article className={`app-card priority-card-${priorityClass(breakdown.final)} ${closed ? 'is-closed' : ''} ${application.pinned ? 'is-pinned' : ''}`} key={application.id} role="button" tabIndex={0} onClick={(event) => { if (!(event.target as HTMLElement).closest('button, a, select, input, textarea, label')) setWorkspaceJobId(job.id); }} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setWorkspaceJobId(job.id); } }}>
          <div className="app-card-company">
            <div className="company-logo">{job.company[0]}</div>
            <div className="app-card-title">
              <strong>{job.company}{application.considering && <span className="considering-badge">고민 중</span>}</strong>
              <small>{job.role}{job.location ? ` · ${job.location}` : ''}</small>
              <JobLinks job={job} onAddNotion={() => open(application.id)} />
            </div>
          </div>
          <div className="app-card-badges">
            <span className="priority-tooltip-wrap"><button type="button" className={`priority-score priority-${priorityClass(breakdown.final)}`} aria-describedby={`priority-${application.id}`}><b>{breakdown.final}<small>점</small></b><span>{priorityLabel}</span></button><span className="priority-tooltip" id={`priority-${application.id}`} role="tooltip"><strong>{breakdown.final}점 · {priorityLabel}{breakdown.deadline ? ` (지원 가치 ${breakdown.value} + 마감 ${breakdown.deadline})` : ''}</strong>{scoreTitle}</span></span>
            <span className={`career-grade grade-${application.careerGrade || 'none'}`} title="직무선호도">{application.careerGrade || '–'}</span>
            <span className="app-card-status-row"><span className={`status status-${statusClass(application.status)}`} title={`${normalizedStatus}${normalizedStatus === '전형 진행' && !['기타', '단계 미등록'].includes(processStageGroup(application)) ? ` · ${processStageGroup(application)}` : ''}`}>{normalizedStatus}{normalizedStatus === '전형 진행' && !['기타', '단계 미등록'].includes(processStageGroup(application)) && <em> · {processStageGroup(application)}</em>}</span>{isSubmitted(application) && <select className={`document-result-chip doc-${documentResultClass(application.documentResult)}`} value={application.documentResult || ''} onChange={(event) => void mutate('서류 결과 기록', () => api.updateApplication(application.id, { documentResult: event.target.value as DocumentResult })).catch(() => undefined)} aria-label={`${job.company} 서류 결과`} title="서류 결과를 기록하면 서류 합격률에 반영돼요."><option value="">서류 대기</option><option value="합격">서류 합격</option><option value="불합격">서류 탈락</option></select>}</span>
          </div>
          {isRejected(application.status) ? <div className="app-card-reason"><small>불합격 사유</small><p>{application.rejectionReason || '아직 남긴 사유가 없습니다.'}</p><button className="text-button" onClick={() => openRejection(application.id)}>사유 수정</button></div> : <>
            <div className="app-card-cell app-card-next"><small>다음 단계</small><strong>{nextLabel}</strong>{normalizedStatus === '전형 진행' ? (processStepsForProgress.length ? <span className="app-card-progress"><span>{completedSteps} / {processStepsForProgress.length}단계</span><span className="process-progress-track"><i style={{ width: `${processProgress}%` }} /></span></span> : <span className="muted-value">단계 미등록</span>) : activeProcessDateLabel && <span className="cell-line"><span className="cell-text">{activeProcessDateLabel}</span>{processDays !== null && processDays >= 0 && <em className="dday">{processDays === 0 ? 'D-DAY' : `D-${processDays}`}</em>}</span>}</div>
            {normalizedStatus === '전형 진행'
              ? <div className={`app-card-cell app-card-date ${processDays !== null && processDays >= 0 && processDays <= 3 ? 'is-urgent' : ''}`}><small>다음 전형 마감</small><strong className="cell-line"><span className="cell-text">{activeProcessDateLabel || '날짜 미정'}</span>{processDays !== null && processDays >= 0 && <em className="dday">{processDays === 0 ? 'D-DAY' : `D-${processDays}`}</em>}</strong>{processStepsForProgress.some((step) => step.result) && <span className="step-result-chain">{processStepsForProgress.filter((step) => step.result).map((step) => <i key={step.id} className={`doc-${documentResultClass(step.result)}`}>{step.name} {step.result === '합격' ? '✓' : '✕'}</i>)}</span>}</div>
              : <div className={`app-card-cell app-card-date ${urgentDeadline ? 'is-urgent' : ''}`}><small>{urgentDeadline ? '마감 임박' : '마감'}</small><strong className="cell-line"><span className="cell-text">{job.alwaysOpen ? '상시 채용' : job.deadline ? dateLabel(job.deadline) : '미정'}</span>{!job.alwaysOpen && deadlineDays !== null && <em className="dday">{deadlineDays === 0 ? 'D-DAY' : deadlineDays > 0 ? `D-${deadlineDays}` : '마감'}</em>}</strong><span>접수 {dateLabel(application.appliedAt)}</span><DeadlineCountdown deadline={job.deadline} compact /></div>}
          </>}
          <div className="app-card-actions"><select value={normalizedStatus} onChange={(event) => void changeApplicationStatus(application.id, event.target.value).catch(() => undefined)} aria-label="상태 변경">{applicationStatuses.map((status) => <option key={status}>{status}</option>)}</select><button className={`icon-btn pin ${application.pinned ? 'active' : ''}`} onClick={() => void mutate(application.pinned ? '상단 고정 해제' : '상단 고정', () => api.updateApplication(application.id, { pinned: !application.pinned })).catch(() => undefined)} aria-label={application.pinned ? '상단 고정 해제' : '상단 고정'} title={application.pinned ? '상단 고정 해제' : '상단에 고정'}><Icon name="star" size={15} /></button><button className="icon-btn" onClick={() => open(application.id)} aria-label="지원 수정" title="수정"><Icon name="edit" size={15} /></button></div>
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
      <label>현재 상태<select name="status" value={editStatus} onChange={(event) => setEditStatus(event.target.value)}>{applicationStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
      {isSubmitted({ id: '', jobId: '', next: '', status: editStatus }) && <fieldset className="document-result-field"><legend>서류 결과 <small>발표가 나면 직접 기록하세요 · ‘서류’ 단계 결과와 연동돼요</small></legend><div>{([['', '대기'], ['합격', '합격'], ['불합격', '탈락']] as const).map(([value, label]) => <label key={value} className={`doc-${documentResultClass(value)}`}><input type="radio" name="documentResult" value={value} checked={documentResult === value} onChange={() => setDocumentResult(value)} /><span>{label}</span></label>)}</div></fieldset>}
      <label className="inline-check considering-check"><input type="checkbox" name="considering" defaultChecked={Boolean(editing?.considering)} /> 지원 여부 고민 중 <small>아직 지원할지 결정하지 않은 공고로 표시합니다.</small></label>
      <PriorityEditor value={priorityInput} onChange={setPriorityInput} job={{ deadline: editingJob?.deadline || '', alwaysOpen }} status={editStatus} profile={workspace.profile} description={editingJob?.description} />
      <div className="form-section-label">지원 일정</div>
      <label className="inline-check"><input type="checkbox" checked={alwaysOpen} onChange={(event) => setAlwaysOpen(event.target.checked)} /> 상시 채용 <small>마감일 없음 · 마감 우선순위 0점</small></label>
      <div className="form-grid two"><label>서류 접수 일시 (24시간)<DateTimeInput name="appliedAt" ariaLabel="서류 접수 일시" defaultValue={editing?.appliedAt || todayDateTimeInputValue()} /></label><label>서류 마감 일시 (24시간)<DateTimeInput name="deadline" ariaLabel="서류 마감 일시" defaultValue={editingJob?.deadline || todayDateTimeInputValue()} disabled={alwaysOpen} /></label></div>
      <div className="form-section-label process-section-head"><span>채용 프로세스</span><small>{processSteps.length ? `${processSteps.filter((step) => step.status === '완료').length} / ${processSteps.length}단계 완료` : ''}</small></div>
      <p className="form-help">상태 버튼은 예정 → 진행 중 → 완료 순으로 바뀌고, 발표가 나면 단계마다 합격·불합격을 고르세요. 일정·할 일은 날짜를 눌러 펼치세요.</p>
      <datalist id="process-suggestions">{nextProcesses.map((process) => <option key={process} value={process} />)}</datalist>
      <div className="pstep-list">{processSteps.map((step, index) => {
        const expanded = expandedStepId === step.id;
        const linkedToDeadline = index === 0 && step.name.trim() === '서류 마감';
        const todos = step.todos || [];
        const openTodos = todos.filter((todo) => !todo.done).length;
        const when = linkedToDeadline ? (alwaysOpen ? '상시 채용' : '마감 일시와 연동') : step.dateTbd || !step.date ? '날짜 미정' : step.timeTbd ? `${dateLabel(step.date.slice(0, 10))} · 시간 미정` : dateLabel(step.date);
        const label = step.name || `${index + 1}번째 단계`;
        return <div className={`pstep pstep-${processStepClass(step.status)} ${expanded ? 'expanded' : ''}`} key={step.id}>
          <div className="pstep-main">
            <button type="button" className="pstep-status" onClick={() => updateProcessStep(step.id, { status: nextStepStatus(step.status) })} aria-label={`${label} 상태 ${step.status}, 눌러서 변경`}>{step.status}</button>
            <input className="pstep-name" aria-label={`${index + 1}번째 단계명`} list="process-suggestions" value={step.name} onChange={(event) => updateProcessStep(step.id, { name: event.target.value })} placeholder="단계명 (예: 1차 면접)" />
            {/마감|제출/.test(step.name) ? <span aria-hidden="true" /> : <select className={`pstep-result doc-${documentResultClass(step.result)}`} value={step.result || ''} onChange={(event) => setStepResult(step, event.target.value as DocumentResult)} aria-label={`${label} 결과`}><option value="">결과 대기</option><option value="합격">합격</option><option value="불합격">불합격</option></select>}
            <button type="button" className="pstep-when" aria-expanded={expanded} onClick={() => setExpandedStepId(expanded ? '' : step.id)}><span>{when}</span>{openTodos > 0 && <em>할 일 {openTodos}</em>}<i className="pstep-chevron" aria-hidden="true" /></button>
            <button type="button" className="pstep-remove" aria-label={`${label} 삭제`} onClick={() => setProcessSteps((steps) => steps.filter((item) => item.id !== step.id))}>×</button>
          </div>
          {expanded && <div className="pstep-detail">
            {linkedToDeadline ? <p className="pstep-note">첫 단계 ‘서류 마감’은 위의 서류 마감 일시로 저장됩니다.</p> : <div className="pstep-date">
              {step.dateTbd ? <span className="process-date-placeholder">아직 정해지지 않음</span> : step.timeTbd ? <DateInput aria-label={`${label} 날짜`} type="date" value={step.date.slice(0, 10)} onChange={(event) => updateProcessStep(step.id, { date: event.target.value })} /> : <DateTimeInput ariaLabel={`${label} 일시`} value={dateTimeInputValue(step.date)} onChange={(value) => updateProcessStep(step.id, { date: value })} />}
              <div className="pstep-date-options"><label><input type="checkbox" checked={Boolean(step.dateTbd)} onChange={(event) => updateProcessStep(step.id, { dateTbd: event.target.checked, timeTbd: event.target.checked ? false : step.timeTbd, date: event.target.checked ? '' : todayDateTimeInputValue() })} /> 날짜 미정</label><label><input type="checkbox" disabled={Boolean(step.dateTbd)} checked={!step.dateTbd && Boolean(step.timeTbd)} onChange={(event) => updateProcessStep(step.id, { timeTbd: event.target.checked, date: event.target.checked ? step.date.slice(0, 10) : step.date ? `${step.date.slice(0, 10)}T00:00` : todayDateTimeInputValue() })} /> 시간 미정</label></div>
            </div>}
            <div className="pstep-todos"><strong>이 단계 할 일</strong>{todos.map((todo) => <label key={todo.id}><input type="checkbox" checked={todo.done} onChange={(event) => updateProcessTodo(step.id, todo.id, { done: event.target.checked })} /><input aria-label={`${label} 할 일`} value={todo.text} onChange={(event) => updateProcessTodo(step.id, todo.id, { text: event.target.value })} placeholder="예: 예상 질문 정리" /><button type="button" aria-label="할 일 삭제" onClick={() => updateProcessStep(step.id, { todos: todos.filter((item) => item.id !== todo.id) })}>×</button></label>)}<button type="button" className="text-button" onClick={() => addProcessTodo(step.id)}>+ 할 일 추가</button></div>
            <div className="pstep-tools"><button type="button" disabled={index === 0} onClick={() => moveProcessStep(index, -1)}>↑ 위로</button><button type="button" disabled={index === processSteps.length - 1} onClick={() => moveProcessStep(index, 1)}>↓ 아래로</button><button type="button" className={step.status === '취소' ? 'active' : ''} onClick={() => updateProcessStep(step.id, { status: step.status === '취소' ? '예정' : '취소' })}>{step.status === '취소' ? '취소 해제' : '이 단계 취소됨'}</button></div>
          </div>}
        </div>;
      })}</div>
      <div className="pstep-add"><span>단계 추가</span>{nextProcesses.filter((process) => process !== '없음' && !processSteps.some((step) => step.name.trim() === process)).map((process) => <button type="button" key={process} onClick={() => addProcessStep(process)}>+ {process}</button>)}<button type="button" className="custom" onClick={() => addProcessStep()}>+ 직접 입력</button></div>
      <label>공고 URL<input name="url" type="url" defaultValue={editingJob?.url || ''} placeholder="https://..." /></label><label>노션 URL<input name="notionUrl" type="url" defaultValue={editingJob?.notionUrl || ''} placeholder="https://www.notion.so/..." /></label>
      {isRejected(editStatus) && <label>불합격 사유<textarea name="rejectionReason" rows={3} defaultValue={editing?.rejectionReason || ''} placeholder="안내받은 사유나 돌아볼 점을 남겨 두세요. (선택)" /></label>}
      <label>메모<textarea name="memo" rows={4} defaultValue={editing?.memo || ''} placeholder="지원 과정에서 기억할 내용을 입력하세요." /></label>
      <div className="modal-actions application-modal-actions">{editing && <button type="button" className="button danger" onClick={() => void remove(editing.id)}>보관함으로 이동</button>}<span /><button type="button" className="button ghost" onClick={() => setModalOpen(false)}>취소</button><button className="button primary">저장</button></div>
    </form></Modal>}
  </>;
}
