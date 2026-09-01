import { useMemo, useState } from 'react';
import { PageHead } from '../components/Common';
import type { View, Workspace } from '../types';
import { dateLabel } from '../utils';

export function CalendarPage({ workspace, navigate }: { workspace: Workspace; navigate: (view: View) => void }) {
  const [cursor, setCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const events = useMemo(() => [
    ...workspace.jobs.filter((job) => job.deadline).map((job) => ({ date: job.deadline, title: `${job.company} 지원 마감`, detail: job.role, type: 'deadline', jobId: job.id })),
    ...workspace.interviews.filter((item) => item.date).map((item) => { const job = workspace.jobs.find((jobItem) => jobItem.company === item.company && jobItem.role === item.role); return { date: item.date, title: `${item.company} ${item.type}`, detail: item.role, type: 'interview', jobId: job?.id || '' }; }),
    ...workspace.applications.flatMap((application) => { const job = workspace.jobs.find((item) => item.id === application.jobId); return (application.processSteps || []).filter((step) => step.date && !['완료', '취소'].includes(step.status)).map((step) => ({ date: step.date, title: `${job?.company || '지원'} ${step.name}`, detail: job?.role || '', type: 'process', jobId: job?.id || '' })); })
  ].sort((a, b) => a.date.localeCompare(b.date)), [workspace]);
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const gridStart = new Date(year, month, 1 - new Date(year, month, 1).getDay());
  const cells = Array.from({ length: 42 }, (_, index) => { const date = new Date(gridStart); date.setDate(gridStart.getDate() + index); return date; });
  const today = new Date();
  function openJob(jobId: string) { if (!jobId) return; const url = new URL(window.location.href); url.searchParams.set('job', jobId); window.history.replaceState(null, '', url); navigate('jobs'); }
  return <>
    <PageHead kicker="SCHEDULE" title="통합 일정" description="공고 마감, 채용 단계와 면접 일정을 한곳에서 확인합니다." />
    <div className="calendar-layout"><section className="card calendar"><div className="calendar-head"><button onClick={() => setCursor(new Date(year, month - 1, 1))}>‹</button><div><h2>{year}년 {month + 1}월</h2><small>다음 달 일정까지 6주 보기</small></div><button onClick={() => setCursor(new Date(year, month + 1, 1))}>›</button></div><div className="weekdays">{['일', '월', '화', '수', '목', '금', '토'].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{cells.map((day) => { const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`; const dayEvents = events.filter((event) => event.date.slice(0, 10) === key); const isToday = day.toDateString() === today.toDateString(); const outside = day.getMonth() !== month; return <div className={`calendar-day ${isToday ? 'today' : ''} ${outside ? 'outside-month' : ''}`} key={key}><b>{outside && day.getDate() === 1 ? `${day.getMonth() + 1}/` : ''}{day.getDate()}</b>{dayEvents.slice(0, 3).map((event) => <button className={`event ${event.type}`} key={`${event.date}-${event.title}`} title={`${dateLabel(event.date)} · ${event.title}`} onClick={() => openJob(event.jobId)}>{event.title}</button>)}{dayEvents.length > 3 && <small className="more-events">+{dayEvents.length - 3}</small>}</div>; })}</div></section><aside className="card agenda"><div className="section-head"><h2>예정된 일정</h2></div>{events.filter((event) => event.date >= new Date().toISOString().slice(0, 10)).slice(0, 10).map((event) => <button className={`agenda-row agenda-${event.type}`} key={`${event.date}-${event.title}`} onClick={() => openJob(event.jobId)}><time>{dateLabel(event.date)}</time><span><strong>{event.title}</strong><small>{event.detail}</small></span></button>)}{!events.length && <p className="empty-note">등록된 일정이 없습니다.</p>}</aside></div>
  </>;
}
