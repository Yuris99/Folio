import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { Modal } from '../components/Modal';
import type { Mutation } from '../hooks/useFolio';
import type { View, Workspace } from '../types';
import { daysUntil } from '../utils';

export function HomePage({ workspace, navigate, mutate }: { workspace: Workspace; navigate: (view: View) => void; mutate: Mutation }) {
  const [taskOpen, setTaskOpen] = useState(false);
  const writing = workspace.applications.filter((item) => ['관심', '작성 중'].includes(item.status)).length;
  const interviews = workspace.applications.filter((item) => item.status === '면접').length;
  const results = workspace.applications.filter((item) => ['합격', '탈락'].includes(item.status)).length;
  const events = [
    ...workspace.jobs.filter((job) => job.deadline).map((job) => ({ date: job.deadline, title: `${job.company} 지원 마감`, detail: job.role })),
    ...workspace.interviews.filter((item) => item.date).map((item) => ({ date: item.date, title: `${item.company} ${item.type}`, detail: item.role }))
  ].filter((item) => daysUntil(item.date) >= 0).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  const completed = Math.round(workspace.tasks.filter((item) => item.done).length / (workspace.tasks.length || 1) * 100);
  const hasProfile = Boolean(workspace.profile.phone && workspace.profile.role);

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate('할 일 저장', () => api.createTask({ text: String(form.get('text')), date: String(form.get('date') || '오늘'), done: false }));
    setTaskOpen(false);
  }

  return <>
    <div className="page-head compact-head"><div><h1>홈</h1></div><span className="date-chip">{new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date())}</span></div>
    {!workspace.applications.length && <div className="onboarding-strip"><div><strong>첫 지원을 등록해 시작하세요.</strong><span>{hasProfile ? '회사와 직무, 마감일만 입력하면 됩니다.' : '먼저 내 이력서를 채우면 지원 문서 작성이 쉬워집니다.'}</span></div><div>{!hasProfile && <button className="button" onClick={() => navigate('career')}>내 정보 작성</button>}<button className="button primary" onClick={() => navigate('applications')}>지원 추가</button></div></div>}
    <div className="grid stats-grid home-stats">
      <button className="card stat stat-link highlight" onClick={() => navigate('applications')}><div className="label">서류 작성 중</div><div className="value">{writing}<span className="unit">건</span></div><span className="stat-arrow">→</span></button>
      <button className="card stat stat-link" onClick={() => navigate('applications')}><div className="label">전체 지원</div><div className="value">{workspace.applications.length}<span className="unit">건</span></div><span className="stat-arrow">→</span></button>
      <button className="card stat stat-link" onClick={() => navigate('interviews')}><div className="label">면접 진행</div><div className="value">{interviews}<span className="unit">건</span></div><span className="stat-arrow">→</span></button>
      <button className="card stat stat-link" onClick={() => navigate('applications')}><div className="label">결과 확인</div><div className="value">{results}<span className="unit">건</span></div><span className="stat-arrow">→</span></button>
    </div>
    <div className="grid dashboard-grid home-panels">
      <article className="card"><div className="section-head"><h2>다가오는 일정</h2><button className="text-button" onClick={() => navigate('calendar')}>달력 보기 →</button></div>{events.map((event) => <button key={`${event.date}-${event.title}`} className="schedule-row" onClick={() => navigate('calendar')}><time><b>{new Date(`${event.date}T00:00:00`).getDate()}</b>{new Intl.DateTimeFormat('ko-KR', { month: 'short' }).format(new Date(`${event.date}T00:00:00`))}</time><span><strong>{event.title}</strong><small>{event.detail}</small></span><i>D-{daysUntil(event.date)}</i></button>)}{!events.length && <p className="empty-note">등록된 일정이 없습니다.</p>}</article>
      <article className="card"><div className="section-head"><h2>할 일</h2><button className="text-button" onClick={() => setTaskOpen(true)}>+ 추가</button></div><div className="task-list">{workspace.tasks.slice(0, 4).map((task) => <label className={`task ${task.done ? 'done' : ''}`} key={task.id}><input type="checkbox" checked={task.done} onChange={() => void mutate('할 일 변경', () => api.updateTask(task.id, { done: !task.done })).catch(() => undefined)} /><span>{task.text}</span><time>{task.date}</time></label>)}{!workspace.tasks.length && <p className="empty-note">오늘 할 일을 추가해 보세요.</p>}</div><div className="progress-wrap"><div className="progress-label"><span>완료</span><b>{completed}%</b></div><div className="progress"><i style={{ width: `${completed}%` }} /></div></div></article>
    </div>
    {taskOpen && <Modal title="할 일 추가" kicker="TASK" compact onClose={() => setTaskOpen(false)}><form onSubmit={addTask}><label>할 일<input required name="text" autoFocus placeholder="예: 자기소개서 2번 문항 작성" /></label><label>기한<input name="date" placeholder="오늘, 내일 또는 날짜" defaultValue="오늘" /></label><div className="modal-actions"><button type="button" className="button ghost" onClick={() => setTaskOpen(false)}>취소</button><button className="button primary">저장</button></div></form></Modal>}
  </>;
}
