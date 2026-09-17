import { useMemo, useState } from 'react';
import { api } from '../api';
import { EmptyState, PageHead } from '../components/Common';
import { JobCreateModal } from '../components/JobCreateModal';
import { Modal } from '../components/Modal';
import { JobWorkspace } from '../components/JobWorkspace';
import type { Mutation } from '../hooks/useFolio';
import type { Application, Job, View, Workspace } from '../types';
import { dateLabel, daysUntil, normalizedApplicationStatus } from '../utils';

type JobStatus = '미지원' | '관심' | '지원 준비' | '전형 진행' | '결과 대기' | '합격' | '불합격' | '포기' | '마감';
type JobSort = 'recent' | 'deadline' | 'company' | 'status';
const jobStatuses: Array<'전체' | JobStatus | '보관됨'> = ['전체', '미지원', '관심', '지원 준비', '전형 진행', '결과 대기', '합격', '불합격', '포기', '마감', '보관됨'];
const statusOrder: JobStatus[] = ['전형 진행', '지원 준비', '관심', '결과 대기', '합격', '불합격', '포기', '미지원', '마감'];

function applicationStatus(application?: Application): JobStatus {
  if (!application) return '미지원';
  if (application.status === '합격') return '합격';
  if (['불합격', '탈락'].includes(application.status)) return '불합격';
  if (application.status === '포기') return '포기';
  if (application.status === '마감') return '마감';
  return normalizedApplicationStatus(application.status) as JobStatus;
}

function deadlineLabel(job: Job): string {
  if (job.alwaysOpen) return '상시';
  if (!job.deadline) return '마감 미정';
  const days = daysUntil(job.deadline);
  return days === 0 ? 'D-DAY' : days > 0 ? `D-${days}` : '마감';
}

export function JobsPage({ workspace, navigate, mutate }: { workspace: Workspace; navigate: (view: View) => void; mutate: Mutation }) {
  const [selectedId, setSelectedId] = useState(() => new URLSearchParams(window.location.search).get('job') || '');
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof jobStatuses)[number]>('전체');
  const [sortBy, setSortBy] = useState<JobSort>('recent');
  const archivedJobIds = new Set(workspace.archivedApplications.map((item) => item.jobId));
  const applicationsByJob = new Map<string, Application>();
  for (const application of workspace.archivedApplications) applicationsByJob.set(application.jobId, application);
  for (const application of workspace.applications) applicationsByJob.set(application.jobId, application);
  const selected = workspace.jobs.find((item) => item.id === selectedId);

  const jobEntries = useMemo(() => workspace.jobs.map((job) => {
    const application = applicationsByJob.get(job.id);
    return { job, application, status: applicationStatus(application), archived: archivedJobIds.has(job.id) && !workspace.applications.some((item) => item.jobId === job.id) };
  }), [workspace]);
  const visibleJobs = useMemo(() => jobEntries.filter(({ job, status, archived }) => {
    const search = query.trim().toLocaleLowerCase();
    const matchesQuery = !search || `${job.company} ${job.role} ${job.location || ''} ${job.description || ''}`.toLocaleLowerCase().includes(search);
    const matchesStatus = statusFilter === '전체' || (statusFilter === '보관됨' ? archived : status === statusFilter);
    return matchesQuery && matchesStatus;
  }).sort((a, b) => {
    if (sortBy === 'deadline') return (a.job.alwaysOpen || !a.job.deadline ? '9999' : a.job.deadline).localeCompare(b.job.alwaysOpen || !b.job.deadline ? '9999' : b.job.deadline);
    if (sortBy === 'company') return `${a.job.company} ${a.job.role}`.localeCompare(`${b.job.company} ${b.job.role}`, 'ko');
    if (sortBy === 'status') return statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
    return (b.application?.updatedAt || b.application?.createdAt || b.job.createdAt || '').localeCompare(a.application?.updatedAt || a.application?.createdAt || a.job.createdAt || '');
  }), [jobEntries, query, statusFilter, sortBy]);

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
    <PageHead kicker="JOB NOTES" title="공고보관함" description="저장한 공고를 지원 상태별로 찾고, 전형 결과와 진행 상황까지 함께 확인합니다." actions={<div className="page-head-actions"><button className="button" onClick={() => navigate('applications')}>← 지원현황</button><button className="button primary" onClick={() => setCreating(true)}>+ 공고 저장</button></div>} />
    <div className="job-summary-filters">{(['전체', '미지원', '전형 진행', '합격', '불합격', '포기', '보관됨'] as const).map((status) => <button type="button" key={status} className={statusFilter === status ? 'active' : ''} onClick={() => setStatusFilter(status)}><b>{jobEntries.filter((entry) => status === '전체' || (status === '보관됨' ? entry.archived : entry.status === status)).length}</b><span>{status}</span></button>)}</div>
    <div className="job-vault-toolbar">
      <label className="application-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="회사·직무·지역 검색" /></label>
      <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as (typeof jobStatuses)[number])} aria-label="공고 지원 상태 필터">{jobStatuses.map((status) => <option key={status}>{status}</option>)}</select>
      <select value={sortBy} onChange={(event) => setSortBy(event.target.value as JobSort)} aria-label="공고 정렬"><option value="recent">최근 변경순</option><option value="deadline">마감 임박순</option><option value="status">지원 상태순</option><option value="company">회사명순</option></select>
    </div>
    {visibleJobs.length ? <div className="grid list-grid job-vault-grid">{visibleJobs.map(({ job, application, status, archived }) => {
      const steps = application?.processSteps || [];
      const completed = steps.filter((step) => step.status === '완료').length;
      const currentStep = steps.find((step) => step.status === '진행 중') || steps.find((step) => step.status === '예정');
      return <button className="card posting-card posting-button job-vault-card" key={job.id} onClick={() => openJob(job.id)}><div className="section-head"><div className="company-logo">{job.company[0]}</div><div className="job-card-badges"><span className={`job-status status-${status.replace(/\s/g, '-')}`}>{status}</span>{archived && <span className="tag">보관됨</span>}</div></div><h3>{job.company}</h3><strong>{job.role}</strong>{job.location && <small className="posting-location">⌖ {job.location}</small>}<div className="job-card-state"><span><small>서류 마감</small><b>{deadlineLabel(job)}</b>{job.deadline && !job.alwaysOpen && <em>{dateLabel(job.deadline)}</em>}</span><span><small>지원 현황</small><b>{status}</b><em>{archived ? '지원 보관함에 있음' : application ? '지원 관리와 연결됨' : '아직 지원 기록 없음'}</em></span>{status === '전형 진행' && <span><small>전형 진행</small><b>{steps.length ? `${completed}/${steps.length}단계` : '단계 미등록'}</b><em>{currentStep?.name || '다음 단계 미정'}</em></span>}</div>{application?.rejectionReason && status === '불합격' && <p className="job-result-note">불합격 사유 · {application.rejectionReason}</p>}<div className="tag-row">{job.skills.slice(0, 4).map((skill) => <span className="tag" key={skill}>{skill}</span>)}</div></button>;
    })}</div> : <EmptyState title="조건에 맞는 공고가 없습니다." description="검색어나 지원 상태 필터를 바꿔 보세요." action={<button className="button" onClick={() => { setQuery(''); setStatusFilter('전체'); }}>필터 초기화</button>} />}
    {creating && <JobCreateModal mutate={mutate} onClose={() => setCreating(false)} onCreated={(job) => { setCreating(false); openJob(job.id); }} />}
    {selected && <Modal title={`${selected.company} · ${selected.role}`} kicker="JOB INFO & NOTES" wide onClose={() => openJob('')}><JobWorkspace job={selected} attachments={workspace.attachments} mutate={mutate} onBack={() => openJob('')} createApplicationLabel={workspace.applications.some((item) => item.jobId === selected.id) ? '지원 관리로 이동' : archivedJobIds.has(selected.id) ? '지원 관리로 복원' : '지원 건 만들기'} onCreateApplication={() => void createApplication(selected)} /></Modal>}
  </>;
}
