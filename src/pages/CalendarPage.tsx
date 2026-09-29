import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api';
import { PageHead } from '../components/Common';
import { JobWorkspace } from '../components/JobWorkspace';
import { Modal } from '../components/Modal';
import type { Mutation } from '../hooks/useFolio';
import type { View, Workspace } from '../types';
import { scheduleWorkspace, dateLabel, daysUntil, duplicatesJobDeadline } from '../utils';

type CalendarEvent = { date: string; title: string; detail: string; type: 'deadline' | 'interview' | 'process'; jobId: string };
const eventLabels = { deadline: '공고 마감', interview: '면접', process: '전형' } as const;
type SyncNotice = { tone: 'ok' | 'error'; title: string; detail: string };
const connectResults: Record<string, SyncNotice> = {
  denied: { tone: 'error', title: '연결이 취소되었습니다', detail: 'Google 권한 화면에서 허용을 눌러야 일정이 동기화됩니다.' },
  scope: { tone: 'error', title: '캘린더 권한이 빠져 있습니다', detail: '다시 연결하면서 “Google Calendar 일정 보기 및 수정” 항목을 체크해 주세요.' },
  failed: { tone: 'error', title: 'Google Calendar 연결에 실패했습니다', detail: '잠시 후 다시 시도해 주세요. 계속 실패하면 Google Cloud의 OAuth 동의 화면 범위와 테스트 사용자 설정을 확인해 주세요.' },
  'not-configured': { tone: 'error', title: '서버에 Google OAuth가 설정되지 않았습니다', detail: 'GOOGLE_CLIENT_ID와 GOOGLE_CLIENT_SECRET 환경 변수를 등록해 주세요.' }
};

export function CalendarPage({ workspace: fullWorkspace, navigate, mutate }: { workspace: Workspace; navigate: (view: View) => void; mutate: Mutation }) {
  const workspace = useMemo(() => scheduleWorkspace(fullWorkspace), [fullWorkspace]);
  const [cursor, setCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [googleStatus, setGoogleStatus] = useState<{ connected: boolean; lastSyncedAt: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<SyncNotice | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [eventFilter, setEventFilter] = useState<'all' | CalendarEvent['type']>('all');
  const [query, setQuery] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  useEffect(() => {
    // Google 권한 화면에서 돌아오면 ?calendar=<결과>가 붙어 옵니다. 한 번 읽고 주소에서 지웁니다.
    const url = new URL(window.location.href);
    const result = url.searchParams.get('calendar');
    if (result) { url.searchParams.delete('calendar'); window.history.replaceState(null, '', url); }
    if (result && connectResults[result]) setNotice(connectResults[result]);
    void api.calendarStatus().then((status) => {
      setGoogleStatus(status);
      if (result === 'connected' && status.connected) void syncCalendar();
    }).catch(() => setGoogleStatus({ connected: false, lastSyncedAt: '' }));
  }, []);
  const events = useMemo(() => {
    const trackedJobIds = new Set(workspace.applications.map((application) => application.jobId));
    return ([
    ...workspace.jobs.filter((job) => job.deadline && trackedJobIds.has(job.id)).map((job) => ({ date: job.deadline, title: `${job.company} 지원 마감`, detail: job.role, type: 'deadline', jobId: job.id })),
    ...workspace.interviews.filter((item) => item.date).map((item) => { const job = workspace.jobs.find((jobItem) => jobItem.company === item.company && jobItem.role === item.role); return { date: item.date, title: `${item.company} ${item.type}`, detail: item.role, type: 'interview', jobId: job?.id || '' }; }),
    ...workspace.applications.flatMap((application) => { const job = workspace.jobs.find((item) => item.id === application.jobId); return (application.processSteps || []).filter((step) => step.date && !['완료', '취소'].includes(step.status) && !duplicatesJobDeadline(step, job)).map((step) => ({ date: step.date, title: `${job?.company || '지원'} ${step.name}`, detail: job?.role || '', type: 'process', jobId: job?.id || '' })); })
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
  function openEvent(event: CalendarEvent) { if (!event.jobId) return navigate(event.type === 'interview' ? 'interviews' : 'applications'); setSelectedJobId(event.jobId); }
  async function syncCalendar() {
    try {
      setSyncing(true);
      const result = await api.syncGoogleCalendar();
      setGoogleStatus({ connected: true, lastSyncedAt: result.lastSyncedAt });
      const summary = `추가 ${result.created} · 업데이트 ${result.updated} · 삭제 ${result.removed}`;
      setNotice(result.failed || result.skipped
        ? { tone: 'error', title: '일부 일정을 동기화하지 못했습니다', detail: `${summary} · 실패 ${result.failed} · 날짜 오류 ${result.skipped}${result.failures.length ? ` (${result.failures.slice(0, 3).join(', ')})` : ''}` }
        : { tone: 'ok', title: 'Google Calendar와 동기화했습니다', detail: summary });
    } catch (error) {
      const body = error instanceof ApiError ? error.details as { details?: { connected?: boolean } } | null : null;
      // 만료·권한 누락이면 서버가 연결을 끊습니다. 버튼을 '연결하기'로 되돌려 바로 다시 연결할 수 있게 합니다.
      if (body?.details?.connected === false) setGoogleStatus({ connected: false, lastSyncedAt: '' });
      setNotice({ tone: 'error', title: '동기화 실패', detail: error instanceof ApiError ? error.message : 'Google Calendar 동기화에 실패했습니다.' });
    } finally { setSyncing(false); }
  }
  async function disconnectCalendar() { if (!window.confirm('Google Calendar 연결을 해제할까요? 이미 생성된 일정은 Google Calendar에 남습니다.')) return; await api.disconnectGoogleCalendar(); setGoogleStatus({ connected: false, lastSyncedAt: '' }); setNotice(null); }
  return <>
    <PageHead kicker="SCHEDULE" title="통합 일정" description="공고 마감, 채용 단계와 면접 일정을 한곳에서 확인합니다." actions={<div className="gcal-bar">
      <span className={`gcal-status ${googleStatus?.connected ? 'on' : ''}`}><i />{googleStatus === null ? '확인 중' : googleStatus.connected ? <span>Google Calendar 연결됨<small>{googleStatus.lastSyncedAt ? `${dateLabel(googleStatus.lastSyncedAt)} 동기화` : '아직 동기화 전'}</small></span> : 'Google Calendar 미연결'}</span>
      {googleStatus?.connected ? <><button className="button ghost small" onClick={() => void disconnectCalendar()}>연결 해제</button><button className="button primary small" disabled={syncing} onClick={() => void syncCalendar()}>{syncing ? '동기화 중…' : '지금 동기화'}</button></> : <button className="button primary small" disabled={googleStatus === null} onClick={api.connectGoogleCalendar}>연결하기</button>}
    </div>} />
    {notice && <div className={`notice notice-${notice.tone}`} role="status"><div><strong>{notice.title}</strong><small>{notice.detail}</small></div><button className="notice-close" aria-label="알림 닫기" onClick={() => setNotice(null)}>×</button></div>}
    <div className="calendar-filters"><label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="회사·직무 검색" /></label><div>{(['all', 'deadline', 'process', 'interview'] as const).map((type) => <button className={eventFilter === type ? 'active' : ''} onClick={() => setEventFilter(type)} key={type}>{type === 'all' ? '전체' : eventLabels[type]}</button>)}</div></div>
    <div className="calendar-layout"><section className="card calendar"><div className="calendar-head"><button onClick={() => setCursor(new Date(year, month - 1, 1))}>‹</button><div><h2>{year}년 {month + 1}월</h2><button className="calendar-today" onClick={() => { const now = new Date(); setCursor(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDate(''); }}>오늘</button></div><button onClick={() => setCursor(new Date(year, month + 1, 1))}>›</button></div><div className="weekdays">{['일', '월', '화', '수', '목', '금', '토'].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{cells.map((day) => { const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`; const dayEvents = events.filter((event) => event.date.slice(0, 10) === key && (eventFilter === 'all' || event.type === eventFilter) && (!query.trim() || `${event.title} ${event.detail}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))); const isToday = day.toDateString() === today.toDateString(); const outside = day.getMonth() !== month; return <div className={`calendar-day ${isToday ? 'today' : ''} ${outside ? 'outside-month' : ''} ${selectedDate === key ? 'selected' : ''}`} key={key} onClick={() => setSelectedDate((current) => current === key ? '' : key)}><b>{outside && day.getDate() === 1 ? `${day.getMonth() + 1}/` : ''}{day.getDate()}</b>{dayEvents.slice(0, 3).map((event) => <button className={`event ${event.type}`} key={`${event.date}-${event.title}`} title={`${dateLabel(event.date)} · ${event.title}`} onClick={(click) => { click.stopPropagation(); openEvent(event); }}>{event.title}</button>)}{dayEvents.length > 3 && <small className="more-events">+{dayEvents.length - 3}</small>}</div>; })}</div>{selectedDate && <div className="mobile-date-events"><div className="calendar-list-head"><div><small>선택한 날짜</small><h2>{dateLabel(selectedDate)}</h2></div><button onClick={() => setSelectedDate('')}>접기</button></div>{visibleEvents.map((event) => <button className={`agenda-row agenda-${event.type}`} key={`mobile-${event.date}-${event.title}`} onClick={() => openEvent(event)}><time>{dateLabel(event.date)}</time><span><i>{eventLabels[event.type]}</i><strong>{event.title}</strong><small>{event.detail}</small></span><span className="agenda-arrow">›</span></button>)}{!visibleEvents.length && <p className="empty-note">이 날짜에는 일정이 없습니다.</p>}</div>}</section><aside className={`card agenda calendar-list-panel ${selectedDate ? 'date-selected' : ''}`}><div className="calendar-list-head"><div><small>{selectedDate ? '선택한 날짜' : 'UPCOMING'}</small><h2>{selectedDate ? dateLabel(selectedDate) : '다가오는 일정'}</h2></div>{selectedDate && <button onClick={() => setSelectedDate('')}>전체 보기</button>}</div><div className="calendar-list-scroll">{visibleEvents.filter((event) => selectedDate || event.date >= new Date().toISOString().slice(0, 10)).slice(0, 30).map((event) => { const dday = daysUntil(event.date); return <button className={`agenda-row agenda-${event.type}`} key={`${event.date}-${event.title}`} onClick={() => openEvent(event)}><time><b>{dateLabel(event.date)}</b><em>{dday === 0 ? 'D-DAY' : dday > 0 ? `D-${dday}` : '지난 일정'}</em></time><span><i>{eventLabels[event.type]}</i><strong>{event.title}</strong><small>{event.detail}</small></span><span className="agenda-arrow">›</span></button>; })}{!visibleEvents.length && <p className="empty-note">조건에 맞는 일정이 없습니다.</p>}</div></aside></div>
    {selectedJobId && (() => { const job = workspace.jobs.find((item) => item.id === selectedJobId); return job ? <Modal title={`${job.company} · ${job.role}`} kicker="JOB INFO & NOTES" wide onClose={() => setSelectedJobId('')}><JobWorkspace job={job} attachments={workspace.attachments} mutate={mutate} onBack={() => setSelectedJobId('')} /></Modal> : null; })()}
  </>;
}
