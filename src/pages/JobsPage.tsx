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
  const [archivedOnly, setArchivedOnly] = useState(false);
  const archivedJobIds = new Set(workspace.archivedApplications.map((item) => item.jobId));
  const visibleJobs = workspace.jobs.filter((job) => !archivedOnly || archivedJobIds.has(job.id));
  const selected = workspace.jobs.find((item) => item.id === selectedId);

  function openJob(id: string) {
    setSelectedId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('job', id); else url.searchParams.delete('job');
    window.history.replaceState(null, '', url);
  }

  async function createApplication(job: Job) {
    if (workspace.applications.some((item) => item.jobId === job.id)) { window.alert('이미 지원 관리에 등록된 공고입니다.'); navigate('applications'); return; }
    const archived = workspace.archivedApplications.find((item) => item.jobId === job.id);
    if (archived) {
      await mutate('지원 복원', () => api.restoreApplication(archived.id));
      await api.syncGoogleCalendar().catch(() => undefined);
      navigate('applications');
      return;
    }
    await mutate('지원 추가', () => api.createApplication({ jobId: job.id, company: job.company, role: job.role, location: job.location || '', status: '관심', appliedAt: '', deadline: job.deadline, nextProcess: '서류 마감', nextDate: job.deadline, processSteps: [{ id: crypto.randomUUID(), name: '서류 마감', date: job.deadline, dateTbd: !job.deadline, status: '예정' }], next: '서류 마감', url: job.url, memo: '' }));
    navigate('applications');
  }

  return <>
    <PageHead kicker="JOB NOTES" title="공고보관함" description="저장한 공고와 지원 관리에서 보관한 기록을 확인하고 다시 지원 관리로 옮길 수 있습니다." actions={<div className="page-head-actions"><button className="button" onClick={() => navigate('applications')}>← 지원현황</button><button className="button primary" onClick={() => setCreating(true)}>+ 공고 저장</button></div>} />
    <div className="page-head-actions"><button className="button" aria-pressed={!archivedOnly} onClick={() => setArchivedOnly(false)}>전체 공고 {workspace.jobs.length}</button><button className="button" aria-pressed={archivedOnly} onClick={() => setArchivedOnly(true)}>보관한 지원 {archivedJobIds.size}</button></div>
    {visibleJobs.length ? <div className="grid list-grid">{visibleJobs.map((job) => <button className="card posting-card posting-button" key={job.id} onClick={() => openJob(job.id)}><div className="section-head"><div className="company-logo">{job.company[0]}</div><span className="deadline">{job.alwaysOpen ? '상시' : daysUntil(job.deadline) >= 0 ? `D-${daysUntil(job.deadline)}` : '마감'}</span></div><h3>{job.company}</h3>{archivedJobIds.has(job.id) && <span className="tag">보관한 지원</span>}<strong>{job.role}</strong>{job.location && <small className="posting-location">⌖ {job.location}</small>}<p>{job.description.slice(0, 110)}{job.description.length > 110 ? '…' : ''}</p><div className="tag-row">{job.skills.slice(0, 4).map((skill) => <span className="tag" key={skill}>{skill}</span>)}</div></button>)}</div> : <EmptyState title={archivedOnly ? "보관한 지원이 없습니다." : "저장한 공고가 없습니다."} description="지원 관리에서 보관함으로 이동한 공고는 이곳에 남습니다." action={<button className="button primary" onClick={() => setCreating(true)}>첫 공고 저장</button>} />}
    {creating && <JobCreateModal mutate={mutate} onClose={() => setCreating(false)} onCreated={(job) => { setCreating(false); openJob(job.id); }} />}
    {selected && <Modal title={`${selected.company} · ${selected.role}`} kicker="JOB INFO & NOTES" wide onClose={() => openJob('')}><JobWorkspace job={selected} attachments={workspace.attachments} mutate={mutate} onBack={() => openJob('')} createApplicationLabel={workspace.applications.some((item) => item.jobId === selected.id) ? "지원 관리로 이동" : archivedJobIds.has(selected.id) ? "지원 관리로 복원" : "지원 건 만들기"} onCreateApplication={() => void createApplication(selected)} /></Modal>}
  </>;
}
