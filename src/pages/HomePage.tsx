import { useEffect, useMemo, useState } from 'react';
import { HomeRecommendations } from '../components/HomeRecommendations';
import { JobCreateModal } from '../components/JobCreateModal';
import { JobWorkspace } from '../components/JobWorkspace';
import { Modal } from '../components/Modal';
import type { Mutation } from '../hooks/useFolio';
import type { View, Workspace } from '../types';
import { statsApplications, applicationStats, scheduleWorkspace, dateLabel, daysUntil, duplicatesJobDeadline, normalizedApplicationStatus } from '../utils';

export function HomePage({ workspace: fullWorkspace, navigate, mutate }: { workspace: Workspace; navigate: (view: View) => void; mutate: Mutation }) {
  const workspace = useMemo(() => scheduleWorkspace(fullWorkspace), [fullWorkspace]);
  const [jobOpen, setJobOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [clock, setClock] = useState(new Date());
  useEffect(() => { const timer = window.setInterval(() => setClock(new Date()), 1000); return () => window.clearInterval(timer); }, []);
  const trackedJobIds = new Set(workspace.applications.map((item) => item.jobId));
  const writing = workspace.applications.filter((item) => normalizedApplicationStatus(item.status) === '지원 준비').length;
  const interviews = workspace.applications.filter((item) => normalizedApplicationStatus(item.status) === '전형 진행').length;
  const allEvents = [
    ...workspace.jobs.filter((job) => job.deadline && trackedJobIds.has(job.id)).map((job) => ({ date: job.deadline, title: `${job.company} 지원 마감`, detail: job.role, type: 'deadline', jobId: job.id })),
    ...workspace.interviews.filter((item) => item.date).map((item) => { const job = workspace.jobs.find((jobItem) => jobItem.company === item.company && jobItem.role === item.role); return { date: item.date, title: `${item.company} ${item.type}`, detail: item.role, type: 'interview', jobId: job?.id || '' }; }),
    ...workspace.applications.flatMap((application) => { const job = workspace.jobs.find((item) => item.id === application.jobId); return (application.processSteps || []).filter((step) => step.date && !['완료', '취소'].includes(step.status) && !duplicatesJobDeadline(step, job)).map((step) => ({ date: step.date, title: `${job?.company || '지원'} ${step.name}`, detail: job?.role || '', type: 'process', jobId: job?.id || '' })); })
  ].sort((a, b) => a.date.localeCompare(b.date));
  const events = allEvents.filter((item) => daysUntil(item.date) >= 0).slice(0, 5);
  const urgentDeadlines = workspace.jobs.filter((job) => job.deadline && !job.alwaysOpen && workspace.applications.some((application) => application.jobId === job.id && ['관심', '지원 준비'].includes(normalizedApplicationStatus(application.status))) && daysUntil(job.deadline) >= 0 && daysUntil(job.deadline) <= 7).sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 3);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const calendarStart = new Date(today.getFullYear(), today.getMonth(), 1 - monthStart.getDay());
  const monthDays = Array.from({ length: 42 }, (_, index) => { const date = new Date(calendarStart); date.setDate(calendarStart.getDate() + index); return date; });
  const stats = useMemo(() => applicationStats(statsApplications(fullWorkspace)), [fullWorkspace]);
  const hasProfile = workspace.careerFacts.some((fact) => fact.status === 'verified');

  function openJob(jobId: string) {
    if (!jobId) return navigate('calendar');
    setSelectedJobId(jobId);
  }

  function openPreparingApplications() {
    const url = new URL(window.location.href);
    url.searchParams.set('status', '지원 준비');
    url.searchParams.set('sort', 'deadline');
    window.history.replaceState(null, '', url);
    navigate('applications');
  }

  return <>
    <div className="page-head compact-head"><div><p className="eyebrow">DASHBOARD</p><h1>오늘의 지원 현황</h1></div><span className="home-clock"><b>{new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(clock)}</b><small>{new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }).format(clock)}</small></span></div>
    {!workspace.applications.length && <div className="onboarding-strip"><div><strong>{hasProfile ? '첫 지원을 등록해 시작하세요.' : '먼저 이력서를 커리어 데이터로 정리하세요.'}</strong><span>{hasProfile ? '회사와 직무, 마감일만 입력하면 됩니다.' : '확인된 데이터는 ChatGPT에서 바로 사용할 수 있습니다.'}</span></div><div>{!hasProfile && <button className="button" onClick={() => navigate('career')}>이력서 정리</button>}<button className="button primary" onClick={() => navigate('applications')}>지원 추가</button></div></div>}
    <div className="grid stats-grid home-stats">
      <button className="card stat stat-link highlight" onClick={openPreparingApplications}><div className="label">서류 작성 중</div><div className="value">{writing}<span className="unit">건</span></div><span className="stat-arrow">→</span></button>
      <button className="card stat stat-link" onClick={() => navigate('applications')}><div className="label">전체 지원</div><div className="value">{workspace.applications.length}<span className="unit">건</span></div><span className="stat-arrow">→</span></button>
      <button className="card stat stat-link" onClick={() => navigate('applications')}><div className="label">전형 진행</div><div className="value">{interviews}<span className="unit">건</span></div><span className="stat-arrow">→</span></button>
    </div>
    {stats.submitted > 0 && <button type="button" className="home-record" aria-label="지원 성과, 통계로 이동" onClick={() => navigate('stats')}>
      <div className="home-record-rate" title="지원 관리에서 직접 기록한 서류 결과로 계산합니다. 결과 대기 중인 지원은 제외됩니다."><small>서류 합격률</small><b>{stats.passRate === null ? '–' : `${stats.passRate}%`}</b><span>합격 {stats.passed} · 탈락 {stats.failed} · 대기 {stats.pending}</span></div>
      <div className="home-record-milestone"><div><small>제출한 원서</small><b>{stats.submitted}<span className="unit">개</span></b></div><div className="home-record-goal"><span>다음 목표 <b>{stats.nextMilestone}개</b>까지 {stats.nextMilestone - stats.submitted}개 🎉</span><span className="progress"><i style={{ width: `${stats.milestoneProgress}%` }} /></span></div></div>
    </button>}
    <HomeRecommendations discovery={fullWorkspace.discovery} navigate={navigate} />
    {!!urgentDeadlines.length && <section className="home-urgent-deadlines home-deadline-strip" aria-label="마감 임박 공고"><div><strong>마감 임박</strong></div><div>{urgentDeadlines.map((job) => { const remainingDays = daysUntil(job.deadline); return <button key={job.id} onClick={() => openJob(job.id)}><span><b>{job.company}</b><small>{job.role}</small></span><em>{remainingDays === 0 ? 'D-DAY' : `D-${remainingDays}`}</em></button>; })}</div></section>}
    <div className="grid dashboard-grid home-panels">
      <article className="card home-calendar-card"><div className="section-head"><div><h2>{today.getMonth() + 1}월 일정</h2><small>오늘 {dateLabel(dateKey(today))}</small></div><button className="text-button" onClick={() => navigate('calendar')}>전체 달력 →</button></div><div className="home-calendar-overview"><div className="home-mini-month"><div className="home-mini-weekdays">{['일','월','화','수','목','금','토'].map((day) => <span key={day}>{day}</span>)}</div><div className="home-mini-days">{monthDays.map((date) => { const key = dateKey(date); const count = allEvents.filter((event) => event.date.slice(0, 10) === key).length; const isToday = key === dateKey(today); const outside = date.getMonth() !== today.getMonth(); return <button className={`${isToday ? 'today' : ''} ${outside ? 'outside' : ''}`} key={key} onClick={() => navigate('calendar')}><b>{date.getDate()}</b>{count > 0 && <i>{count}</i>}</button>; })}</div></div><div className="home-upcoming-list">{events.map((event) => <button className={`home-event-${event.type}`} key={`${event.date}-${event.title}`} onClick={() => openJob(event.jobId)}><time>{dateLabel(event.date)}</time><strong>{event.title}</strong><small>{event.detail}</small></button>)}{!events.length && <p className="empty-note">등록된 일정이 없습니다.</p>}</div></div></article>
      <article className="card home-jobs-card"><div className="section-head"><h2>공고 보관함</h2><button className="text-button" onClick={() => setJobOpen(true)}>+ 추가</button></div><div className="home-job-list">{workspace.jobs.slice(0, 4).map((job) => <button key={job.id} onClick={() => openJob(job.id)}><span className="company-logo">{job.company[0]}</span><span><strong>{job.company}</strong><small>{job.role}</small></span><time>{dateLabel(job.deadline)}</time></button>)}{!workspace.jobs.length && <p className="empty-note">관심 공고를 바로 추가해 보세요.</p>}</div><button className="home-jobs-all" onClick={() => navigate('jobs')}>공고 전체 보기 →</button></article>
    </div>
    {jobOpen && <JobCreateModal mutate={mutate} onClose={() => setJobOpen(false)} onCreated={(job) => { setJobOpen(false); openJob(job.id); }} />}
    {selectedJobId && (() => { const job = workspace.jobs.find((item) => item.id === selectedJobId); return job ? <Modal title={`${job.company} · ${job.role}`} kicker="JOB INFO & NOTES" wide onClose={() => setSelectedJobId('')}><JobWorkspace job={job} attachments={workspace.attachments} mutate={mutate} onBack={() => setSelectedJobId('')} /></Modal> : null; })()}
  </>;
}
