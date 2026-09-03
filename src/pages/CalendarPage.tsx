import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { PageHead } from '../components/Common';
import type { View, Workspace } from '../types';
import { dateLabel, daysUntil } from '../utils';

type CalendarEvent = { date: string; title: string; detail: string; type: 'deadline' | 'interview' | 'process'; jobId: string };
const eventLabels = { deadline: '공고 마감', interview: '면접', process: '전형' } as const;

export function CalendarPage({ workspace, navigate }: { workspace: Workspace; navigate: (view: View) => void }) {
  const [cursor, setCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [googleStatus, setGoogleStatus] = useState<{ connected: boolean; lastSyncedAt: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [eventFilter, setEventFilter] = useState<'all' | CalendarEvent['type']>('all');
  const [query, setQuery] = useState('');
  useEffect(() => { void api.calendarStatus().then(setGoogleStatus).catch(() => setGoogleStatus({ connected: false, lastSyncedAt: '' })); }, []);
  const events = useMemo(() => {
    const trackedJobIds = new Set(workspace.applications.map((application) => application.jobId));
    return ([
    ...workspace.jobs.filter((job) => job.deadline && trackedJobIds.has(job.id)).map((job) => ({ date: job.deadline, title: `${job.company} 지원 마감`, detail: job.role, type: 'deadline', jobId: job.id })),
    ...workspace.interviews.filter((item) => item.date).map((item) => { const job = workspace.jobs.find((jobItem) => jobItem.company === item.company && jobItem.role === item.role); return { date: item.date, title: `${item.company} ${item.type}`, detail: item.role, type: 'interview', jobId: job?.id || '' }; }),
    ...workspace.applications.flatMap((application) => { const job = workspace.jobs.find((item) => item.id === application.jobId); return (application.processSteps || []).filter((step) => step.date && !['완료', '취소'].includes(step.status)).map((step) => ({ date: step.date, title: `${job?.company || '지원'} ${step.name}`, detail: job?.role || '', type: 'process', jobId: job?.id || '' })); })
  ] as CalendarEvent[]).sort((a, b) => a.date.localeCompare(b.date));
  }, [workspace]);
  const visibleEvents = useMemo(() => events.filter((event) => {
    const matchesDate = !selectedDate || event.date.slice(0, 10) === selectedDate;
    const matchesType = eventFilter === 'all' || event.type === eventFilter;
    const search = query.trim().toLocaleLowerCase();
    return matchesDate && matchesType && (!search || `${event.title} ${event.detail}`.toLocaleLowerCase().includes(search));
  }), [events, selectedDate, eventFilter, query]);
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const gridStart = new Date(year, month, 1 - new Date(year, month, 1).getDay());
  const cells = Array.from({ length: 42 }, (_, index) => { const date = new Date(gridStart); date.setDate(gridStart.getDate() + index); return date; });
  const today = new Date();
  function openEvent(event: CalendarEvent) { if (!event.jobId) return navigate(event.type === 'interview' ? 'interviews' : 'applications'); const url = new URL(window.location.href); url.searchParams.set('job', event.jobId); window.history.replaceState(null, '', url); navigate('jobs'); }
  async function syncCalendar() { try { setSyncing(true); const result = await api.syncGoogleCalendar(); setGoogleStatus({ connected: true, lastSyncedAt: result.lastSyncedAt }); window.alert(`Google Calendar에 ${result.total}개 일정을 동기화했습니다.`); } finally { setSyncing(false); } }
  async function disconnectCalendar() { if (!window.confirm('Google Calendar 연결을 해제할까요? 이미 생성된 일정은 Google Calendar에 남습니다.')) return; await api.disconnectGoogleCalendar(); setGoogleStatus({ connected: false, lastSyncedAt: '' }); }
  return <>
    <PageHead kicker="SCHEDULE" title="통합 일정" description="공고 마감, 채용 단계와 면접 일정을 한곳에서 확인합니다." actions={<div className="calendar-sync-actions">{googleStatus?.connected ? <><button className="button" onClick={() => void disconnectCalendar()}>연결 해제</button><button className="button primary" disabled={syncing} onClick={() => void syncCalendar()}>{syncing ? '동기화 중…' : 'Google Calendar 동기화'}</button></> : <button className="button primary" onClick={api.connectGoogleCalendar}>Google Calendar 연결</button>}</div>} />
    {googleStatus?.connected && <div className="calendar-sync-state"><span>Google Calendar 단방향 연결됨</span><small>{googleStatus.lastSyncedAt ? `마지막 동기화 ${dateLabel(googleStatus.lastSyncedAt)}` : '아직 동기화하지 않았습니다.'}</small></div>}
    <div className="calendar-filters"><label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="회사·직무 검색" /></label><div>{(['all', 'deadline', 'process', 'interview'] as const).map((type) => <button className={eventFilter === type ? 'active' : ''} onClick={() => setEventFilter(type)} key={type}>{type === 'all' ? '전체' : eventLabels[type]}</button>)}</div></div>
    <div className="calendar-layout"><section className="card calendar"><div className="calendar-head"><button onClick={() => setCursor(new Date(year, month - 1, 1))}>‹</button><div><h2>{year}년 {month + 1}월</h2><button className="calendar-today" onClick={() => { const now = new Date(); setCursor(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDate(''); }}>오늘</button></div><button onClick={() => setCursor(new Date(year, month + 1, 1))}>›</button></div><div className="weekdays">{['일', '월', '화', '수', '목', '금', '토'].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{cells.map((day) => { const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`; const dayEvents = events.filter((event) => event.date.slice(0, 10) === key && (eventFilter === 'all' || event.type === eventFilter) && (!query.trim() || `${event.title} ${event.detail}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))); const isToday = day.toDateString() === today.toDateString(); const outside = day.getMonth() !== month; return <div className={`calendar-day ${isToday ? 'today' : ''} ${outside ? 'outside-month' : ''} ${selectedDate === key ? 'selected' : ''}`} key={key} onClick={() => setSelectedDate((current) => current === key ? '' : key)}><b>{outside && day.getDate() === 1 ? `${day.getMonth() + 1}/` : ''}{day.getDate()}</b>{dayEvents.slice(0, 3).map((event) => <button className={`event ${event.type}`} key={`${event.date}-${event.title}`} title={`${dateLabel(event.date)} · ${event.title}`} onClick={(click) => { click.stopPropagation(); openEvent(event); }}>{event.title}</button>)}{dayEvents.length > 3 && <small className="more-events">+{dayEvents.length - 3}</small>}</div>; })}</div></section><aside className="card agenda calendar-list-panel"><div className="calendar-list-head"><div><small>{selectedDate ? '선택한 날짜' : 'UPCOMING'}</small><h2>{selectedDate ? dateLabel(selectedDate) : '다가오는 일정'}</h2></div>{selectedDate && <button onClick={() => setSelectedDate('')}>전체 보기</button>}</div><div className="calendar-list-scroll">{visibleEvents.filter((event) => selectedDate || event.date >= new Date().toISOString().slice(0, 10)).slice(0, 30).map((event) => { const dday = daysUntil(event.date); return <button className={`agenda-row agenda-${event.type}`} key={`${event.date}-${event.title}`} onClick={() => openEvent(event)}><time><b>{dateLabel(event.date)}</b><em>{dday === 0 ? 'D-DAY' : dday > 0 ? `D-${dday}` : '지난 일정'}</em></time><span><i>{eventLabels[event.type]}</i><strong>{event.title}</strong><small>{event.detail}</small></span><span className="agenda-arrow">›</span></button>; })}{!visibleEvents.length && <p className="empty-note">조건에 맞는 일정이 없습니다.</p>}</div></aside></div>
  </>;
}
