import { useState } from 'react';
import { api } from '../api';
import { EmptyState, PageHead } from '../components/Common';
import { JobCreateModal } from '../components/JobCreateModal';
import { Modal } from '../components/Modal';
import { JobWorkspace } from '../components/JobWorkspace';
import type { Mutation } from '../hooks/useFolio';
import type { Job, View, Workspace } from '../types';
import { daysUntil } from '../utils';

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

  async function createApplication(job: Job) {
    if (workspace.applications.some((item) => item.jobId === job.id)) { window.alert('이미 지원 관리에 등록된 공고입니다.'); navigate('applications'); return; }
    await mutate('지원 추가', () => api.createApplication({ jobId: job.id, company: job.company, role: job.role, status: '관심', appliedAt: '', deadline: job.deadline, nextProcess: '서류 제출', nextDate: '', processSteps: [{ id: crypto.randomUUID(), name: '서류 제출', date: '', status: '예정' }], next: '서류 제출', url: job.url, memo: '' }));
    navigate('applications');
  }

  return <>
    <PageHead kicker="JOB NOTES" title="공고 정리" description="지원현황에 연결할 공고와 회사별 정리 페이지입니다." actions={<div className="page-head-actions"><button className="button" onClick={() => navigate('applications')}>← 지원현황</button><button className="button primary" onClick={() => setCreating(true)}>+ 공고 저장</button></div>} />
    {workspace.jobs.length ? <div className="grid list-grid">{workspace.jobs.map((job) => <button className="card posting-card posting-button" key={job.id} onClick={() => setSelectedId(job.id)}><div className="section-head"><div className="company-logo">{job.company[0]}</div><span className="deadline">{daysUntil(job.deadline) >= 0 ? `D-${daysUntil(job.deadline)}` : '마감'}</span></div><h3>{job.company}</h3><strong>{job.role}</strong><p>{job.description.slice(0, 110)}{job.description.length > 110 ? '…' : ''}</p><div className="tag-row">{job.skills.slice(0, 4).map((skill) => <span className="tag" key={skill}>{skill}</span>)}</div></button>)}</div> : <EmptyState title="저장한 공고가 없습니다." description="공고 본문을 붙여 넣으면 핵심 기술을 정리하고 지원 기록으로 연결할 수 있습니다." action={<button className="button primary" onClick={() => setCreating(true)}>첫 공고 저장</button>} />}
    {creating && <JobCreateModal mutate={mutate} onClose={() => setCreating(false)} onCreated={(job) => { setCreating(false); openJob(job.id); }} />}
    {selected && <Modal title={`${selected.company} · ${selected.role}`} kicker="JOB INFO & NOTES" wide onClose={() => openJob('')}><JobWorkspace job={selected} attachments={workspace.attachments} mutate={mutate} onBack={() => openJob('')} onCreateApplication={() => void createApplication(selected)} /></Modal>}
  </>;
}
