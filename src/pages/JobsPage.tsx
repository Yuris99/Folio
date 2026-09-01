import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { EmptyState, PageHead } from '../components/Common';
import { Modal } from '../components/Modal';
import { JobWorkspace } from '../components/JobWorkspace';
import type { Mutation } from '../hooks/useFolio';
import type { Job, View, Workspace } from '../types';
import { daysUntil, todayDateTimeInputValue } from '../utils';

export function JobsPage({ workspace, navigate, mutate }: { workspace: Workspace; navigate: (view: View) => void; mutate: Mutation }) {
  const [selectedId, setSelectedId] = useState(() => new URLSearchParams(window.location.search).get('job') || '');
  const [creating, setCreating] = useState(false);
  const selected = workspace.jobs.find((item) => item.id === selectedId);

  function openJob(id: string) {
    setSelectedId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('job', id); else url.searchParams.delete('job');
    window.history.replaceState(null, '', url);
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const base = { company: String(data.get('company')), role: String(data.get('role')), deadline: String(data.get('deadline')), url: String(data.get('url')), description: String(data.get('description')) };
    const analysis = await mutate('공고 분석', () => api.analyzeJob(base), false);
    const job = await mutate('공고 저장', () => api.createJob({ ...base, skills: analysis.skills || [] })) as Job;
    setSelectedId(job.id);
    setCreating(false);
  }

  async function createApplication(job: Job) {
    if (workspace.applications.some((item) => item.jobId === job.id)) { window.alert('이미 지원 관리에 등록된 공고입니다.'); navigate('applications'); return; }
    await mutate('지원 추가', () => api.createApplication({ jobId: job.id, company: job.company, role: job.role, status: '관심', appliedAt: '', deadline: job.deadline, nextProcess: '서류 제출', nextDate: '', processSteps: [{ id: crypto.randomUUID(), name: '서류 제출', date: '', status: '예정' }], next: '서류 제출', url: job.url, memo: '' }));
    navigate('applications');
  }

  if (selected) {
    return <JobWorkspace job={selected} attachments={workspace.attachments} mutate={mutate} onBack={() => openJob('')} onCreateApplication={() => void createApplication(selected)} />;
  }

  return <>
    <PageHead kicker="JOB ARCHIVE" title="공고 보관함" description="관심 있는 공고 원문을 저장하고 지원으로 전환합니다." actions={<button className="button primary" onClick={() => setCreating(true)}>+ 공고 저장</button>} />
    {workspace.jobs.length ? <div className="grid list-grid">{workspace.jobs.map((job) => <button className="card posting-card posting-button" key={job.id} onClick={() => setSelectedId(job.id)}><div className="section-head"><div className="company-logo">{job.company[0]}</div><span className="deadline">{daysUntil(job.deadline) >= 0 ? `D-${daysUntil(job.deadline)}` : '마감'}</span></div><h3>{job.company}</h3><strong>{job.role}</strong><p>{job.description.slice(0, 110)}{job.description.length > 110 ? '…' : ''}</p><div className="tag-row">{job.skills.slice(0, 4).map((skill) => <span className="tag" key={skill}>{skill}</span>)}</div></button>)}</div> : <EmptyState title="저장한 공고가 없습니다." description="공고 본문을 붙여 넣으면 핵심 기술을 정리하고 지원 기록으로 연결할 수 있습니다." action={<button className="button primary" onClick={() => setCreating(true)}>첫 공고 저장</button>} />}
    {creating && <Modal title="채용 공고 저장" kicker="NEW OPPORTUNITY" onClose={() => setCreating(false)}><form onSubmit={create}><p className="muted">공고 본문을 붙여 넣으면 핵심 기술을 분석해 저장합니다.</p><div className="form-grid two"><label>회사명<input required name="company" /></label><label>직무명<input required name="role" /></label></div><div className="form-grid two"><label>마감 일시 (24시간)<input name="deadline" type="datetime-local" min="2000-01-01T00:00" max="2100-12-31T23:59" defaultValue={todayDateTimeInputValue()} /></label><label>공고 URL<input name="url" type="url" placeholder="https://..." /></label></div><label>채용 공고 본문<textarea required name="description" rows={10} placeholder="주요 업무, 자격 요건, 우대 사항을 붙여 넣으세요." /></label><div className="modal-actions"><button type="button" className="button ghost" onClick={() => setCreating(false)}>취소</button><button className="button primary">분석하고 저장</button></div></form></Modal>}
  </>;
}
