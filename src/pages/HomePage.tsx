import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import { DeadlineCountdown } from '../components/DeadlineCountdown';
import { JobCreateModal } from '../components/JobCreateModal';
import { Modal } from '../components/Modal';
import type { Mutation } from '../hooks/useFolio';
import type { View, Workspace } from '../types';
import { dateLabel, daysUntil, normalizedApplicationStatus } from '../utils';

export function HomePage({ workspace, navigate, mutate }: { workspace: Workspace; navigate: (view: View) => void; mutate: Mutation }) {
  const [taskOpen, setTaskOpen] = useState(false);
  const [jobOpen, setJobOpen] = useState(false);
  const [clock, setClock] = useState(new Date());
  useEffect(() => { const timer = window.setInterval(() => setClock(new Date()), 1000); return () => window.clearInterval(timer); }, []);
  const trackedJobIds = new Set(workspace.applications.map((item) => item.jobId));
  const writing = workspace.applications.filter((item) => ['관심', '지원 준비'].includes(normalizedApplicationStatus(item.status))).length;
  const interviews = workspace.applications.filter((item) => normalizedApplicationStatus(item.status) === '전형 진행').length;
  const results = workspace.applications.filter((item) => normalizedApplicationStatus(item.status) === '결과 대기').length;
  const allEvents = [
    ...workspace.jobs.filter((job) => job.deadline && trackedJobIds.has(job.id)).map((job) => ({ date: job.deadline, title: `${job.company} 지원 마감`, detail: job.role, type: 'deadline', jobId: job.id })),
    ...workspace.interviews.filter((item) => item.date).map((item) => { const job = workspace.jobs.find((jobItem) => jobItem.company === item.company && jobItem.role === item.role); return { date: item.date, title: `${item.company} ${item.type}`, detail: item.role, type: 'interview', jobId: job?.id || '' }; }),
    ...workspace.applications.flatMap((application) => { const job = workspace.jobs.find((item) => item.id === application.jobId); return (application.processSteps || []).filter((step) => step.date && !['완료', '취소'].includes(step.status)).map((step) => ({ date: step.date, title: `${job?.company || '지원'} ${step.name}`, detail: job?.role || '', type: 'process', jobId: job?.id || '' })); })
  ].sort((a, b) => a.date.localeCompare(b.date));
  const events = allEvents.filter((item) => daysUntil(item.date) >= 0).slice(0, 5);
  const urgentDeadlines = workspace.jobs.filter((job) => job.deadline && trackedJobIds.has(job.id) && daysUntil(job.deadline) >= 0 && daysUntil(job.deadline) <= 7).sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 4);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const calendarStart = new Date(today.getFullYear(), today.getMonth(), 1 - monthStart.getDay());
  const monthDays = Array.from({ length: 42 }, (_, index) => { const date = new Date(calendarStart); date.setDate(calendarStart.getDate() + index); return date; });
  const processTodos = workspace.applications.flatMap((application) => { const job = workspace.jobs.find((item) => item.id === application.jobId); return (application.processSteps || []).flatMap((step) => (step.todos || []).map((todo) => ({ ...todo, kind: 'process' as const, applicationId: application.id, stepId: step.id, company: job?.company || '지원', process: step.name, date: step.date }))); });
  const homeTodos = [...workspace.tasks.map((task) => ({ ...task, kind: 'general' as const })), ...processTodos].filter((task) => !task.done).slice(0, 6);
  const totalTodoCount = workspace.tasks.length + processTodos.length;
  const completedTodoCount = workspace.tasks.filter((item) => item.done).length + processTodos.filter((item) => item.done).length;
  const completed = Math.round(completedTodoCount / (totalTodoCount || 1) * 100);
  const hasProfile = workspace.careerFacts.some((fact) => fact.status === 'verified');

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate('할 일 저장', () => api.createTask({ text: String(form.get('text')), date: String(form.get('date') || '오늘'), done: false }));
    setTaskOpen(false);
  }

  async function toggleProcessTodo(applicationId: string, stepId: string, todoId: string) {
    const application = workspace.applications.find((item) => item.id === applicationId);
    if (!application) return;
    const processSteps = (application.processSteps || []).map((step) => step.id === stepId ? { ...step, todos: (step.todos || []).map((todo) => todo.id === todoId ? { ...todo, done: !todo.done } : todo) } : step);
    await mutate('전형 할 일 변경', () => api.updateApplication(application.id, { processSteps })).catch(() => undefined);
  }

  function openJob(jobId: string) {
    if (!jobId) return navigate('calendar');
    const url = new URL(window.location.href);
    url.searchParams.set('job', jobId);
    window.history.replaceState(null, '', url);
    navigate('jobs');
  }

  return <>
    <div className="page-head compact-head"><div><h1>홈</h1></div><span className="home-clock"><b>{new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(clock)}</b><small>{new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }).format(clock)}</small></span></div>
    {!workspace.applications.length && <div className="onboarding-strip"><div><strong>{hasProfile ? '첫 지원을 등록해 시작하세요.' : '먼저 이력서를 커리어 데이터로 정리하세요.'}</strong><span>{hasProfile ? '회사와 직무, 마감일만 입력하면 됩니다.' : '확인된 데이터는 ChatGPT에서 바로 사용할 수 있습니다.'}</span></div><div>{!hasProfile && <button className="button" onClick={() => navigate('career')}>이력서 정리</button>}<button className="button primary" onClick={() => navigate('applications')}>지원 추가</button></div></div>}
    <div className="grid stats-grid home-stats">
      <button className="card stat stat-link highlight" onClick={() => navigate('applications')}><div className="label">서류 작성 중</div><div className="value">{writing}<span className="unit">건</span></div><span className="stat-arrow">→</span></button>
      <button className="card stat stat-link" onClick={() => navigate('applications')}><div className="label">전체 지원</div><div className="value">{workspace.applications.length}<span className="unit">건</span></div><span className="stat-arrow">→</span></button>
      <button className="card stat stat-link" onClick={() => navigate('applications')}><div className="label">전형 진행</div><div className="value">{interviews}<span className="unit">건</span></div><span className="stat-arrow">→</span></button>
      <button className="card stat stat-link" onClick={() => navigate('applications')}><div className="label">결과 확인</div><div className="value">{results}<span className="unit">건</span></div><span className="stat-arrow">→</span></button>
    </div>
    {!!urgentDeadlines.length && <section className="home-urgent-deadlines"><div><strong>마감 임박</strong><small>마감이 가까울수록 지원 우선순위가 크게 올라갑니다.</small></div><div>{urgentDeadlines.map((job) => { const remainingDays = daysUntil(job.deadline); return <button key={job.id} onClick={() => openJob(job.id)}><span><b>{job.company}</b><small>{job.role}</small></span><em>{remainingDays === 0 ? 'D-DAY' : `D-${remainingDays}`}</em><DeadlineCountdown deadline={job.deadline} compact /></button>; })}</div></section>}
    <div className="grid dashboard-grid home-panels">
      <article className="card home-calendar-card"><div className="section-head"><div><h2>{today.getMonth() + 1}월 일정</h2><small>오늘 {dateLabel(dateKey(today))}</small></div><button className="text-button" onClick={() => navigate('calendar')}>전체 달력 →</button></div><div className="home-calendar-overview"><div className="home-mini-month"><div className="home-mini-weekdays">{['일','월','화','수','목','금','토'].map((day) => <span key={day}>{day}</span>)}</div><div className="home-mini-days">{monthDays.map((date) => { const key = dateKey(date); const count = allEvents.filter((event) => event.date.slice(0, 10) === key).length; const isToday = key === dateKey(today); const outside = date.getMonth() !== today.getMonth(); return <button className={`${isToday ? 'today' : ''} ${outside ? 'outside' : ''}`} key={key} onClick={() => navigate('calendar')}><b>{date.getDate()}</b>{count > 0 && <i>{count}</i>}</button>; })}</div></div><div className="home-upcoming-list">{events.map((event) => <button className={`home-event-${event.type}`} key={`${event.date}-${event.title}`} onClick={() => openJob(event.jobId)}><time>{dateLabel(event.date)}</time><strong>{event.title}</strong><small>{event.detail}</small></button>)}{!events.length && <p className="empty-note">등록된 일정이 없습니다.</p>}</div></div></article>
      <article className="card"><div className="section-head"><h2>통합 할 일</h2><div><button className="text-button" onClick={() => navigate('applications')}>전형별 관리</button><button className="text-button" onClick={() => setTaskOpen(true)}>+ 일반 할 일</button></div></div><div className="task-list">{homeTodos.map((task) => task.kind === 'general' ? <label className="task" key={`general-${task.id}`}><input type="checkbox" checked={task.done} onChange={() => void mutate('할 일 변경', () => api.updateTask(task.id, { done: !task.done })).catch(() => undefined)} /><span>{task.text}</span><time>{task.date}</time></label> : <label className="task process-task" key={`process-${task.applicationId}-${task.stepId}-${task.id}`}><input type="checkbox" checked={task.done} onChange={() => void toggleProcessTodo(task.applicationId, task.stepId, task.id)} /><span><b>{task.text}</b><small>{task.company} · {task.process}</small></span><time>{dateLabel(task.date)}</time></label>)}{!homeTodos.length && <p className="empty-note">남은 할 일이 없습니다.</p>}</div><div className="progress-wrap"><div className="progress-label"><span>전체 완료</span><b>{completed}%</b></div><div className="progress"><i style={{ width: `${completed}%` }} /></div></div></article>
      <article className="card home-jobs-card"><div className="section-head"><h2>공고 보관함</h2><button className="text-button" onClick={() => setJobOpen(true)}>+ 추가</button></div><div className="home-job-list">{workspace.jobs.slice(0, 4).map((job) => <button key={job.id} onClick={() => openJob(job.id)}><span className="company-logo">{job.company[0]}</span><span><strong>{job.company}</strong><small>{job.role}</small></span><time>{dateLabel(job.deadline)}</time></button>)}{!workspace.jobs.length && <p className="empty-note">관심 공고를 바로 추가해 보세요.</p>}</div><button className="home-jobs-all" onClick={() => navigate('jobs')}>공고 전체 보기 →</button></article>
    </div>
    {taskOpen && <Modal title="할 일 추가" kicker="TASK" compact onClose={() => setTaskOpen(false)}><form onSubmit={addTask}><label>할 일<input required name="text" autoFocus placeholder="예: 자기소개서 2번 문항 작성" /></label><label>기한<input name="date" placeholder="오늘, 내일 또는 날짜" defaultValue="오늘" /></label><div className="modal-actions"><button type="button" className="button ghost" onClick={() => setTaskOpen(false)}>취소</button><button className="button primary">저장</button></div></form></Modal>}
    {jobOpen && <JobCreateModal mutate={mutate} onClose={() => setJobOpen(false)} onCreated={(job) => { setJobOpen(false); openJob(job.id); }} />}
  </>;
}
