import { useMemo, useState } from 'react';
import { InterviewModal } from '../components/InterviewModal';
import { PageHead } from '../components/Common';
import type { Mutation } from '../hooks/useFolio';
import type { Workspace } from '../types';
import { dateLabel } from '../utils';

export function CalendarPage({ workspace, mutate }: { workspace: Workspace; mutate: Mutation }) {
  const [cursor, setCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [adding, setAdding] = useState(false);
  const events = useMemo(() => [
    ...workspace.jobs.filter((job) => job.deadline).map((job) => ({ date: job.deadline, title: `${job.company} 지원 마감`, detail: job.role, type: 'deadline' })),
    ...workspace.interviews.filter((item) => item.date).map((item) => ({ date: item.date, title: `${item.company} ${item.type}`, detail: item.role, type: 'interview' }))
  ].sort((a, b) => a.date.localeCompare(b.date)), [workspace]);
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [...Array.from({ length: firstDay }, () => null), ...Array.from({ length: lastDate }, (_, index) => index + 1)];
  const today = new Date();
  return <>
    <PageHead kicker="SCHEDULE" title="일정" description="지원 마감과 면접 일정을 월간 달력으로 확인합니다." actions={<button className="button primary" onClick={() => setAdding(true)}>+ 면접 일정</button>} />
    <div className="calendar-layout"><section className="card calendar"><div className="calendar-head"><button onClick={() => setCursor(new Date(year, month - 1, 1))}>‹</button><h2>{year}년 {month + 1}월</h2><button onClick={() => setCursor(new Date(year, month + 1, 1))}>›</button></div><div className="weekdays">{['일', '월', '화', '수', '목', '금', '토'].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{cells.map((day, index) => day ? <div className={`calendar-day ${day === today.getDate() && month === today.getMonth() && year === today.getFullYear() ? 'today' : ''}`} key={`${day}-${index}`}><b>{day}</b>{events.filter((event) => { const date = new Date(event.date.includes('T') ? event.date : `${event.date}T00:00:00`); return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day; }).map((event) => <span className={`event ${event.type}`} key={`${event.date}-${event.title}`} title={`${dateLabel(event.date)} · ${event.title}`}>{event.title}</span>)}</div> : <div className="calendar-day empty" key={`empty-${index}`} />)}</div></section><aside className="card agenda"><div className="section-head"><h2>예정된 일정</h2><button className="text-button" onClick={() => setAdding(true)}>+ 추가</button></div>{events.filter((event) => event.date >= new Date().toISOString().slice(0, 10)).slice(0, 8).map((event) => <div className="agenda-row" key={`${event.date}-${event.title}`}><time>{dateLabel(event.date)}</time><span><strong>{event.title}</strong><small>{event.detail}</small></span></div>)}{!events.length && <p className="empty-note">등록된 일정이 없습니다.</p>}</aside></div>
    {adding && <InterviewModal mutate={mutate} onClose={() => setAdding(false)} />}
  </>;
}
