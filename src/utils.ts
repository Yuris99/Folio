import type { Application, Job, Workspace } from './types';

export const applicationStatuses = ['관심', '지원 준비', '전형 진행', '결과 대기', '불합격'];

export function normalizedApplicationStatus(status: string): string {
  if (['탈락', '불합격'].includes(status)) return '불합격';
  if (['합격', '포기', '마감'].includes(status)) return '결과 대기';
  if (['관심'].includes(status)) return '관심';
  if (['작성 중', '서류 준비', '지원 준비'].includes(status)) return '지원 준비';
  if (['처우 협의', '결과 대기'].includes(status)) return '결과 대기';
  return '전형 진행';
}

export const nextProcesses = ['서류 마감', '서류 제출', '서류 결과', '인적성 검사', '코딩 테스트', '1차 면접', '2차 면접', '최종 면접', '처우 협의', '최종 결과', '없음'];

export function dateLabel(value?: string): string {
  if (!value) return '미정';
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', weekday: 'short' };
  if (value.includes('T') && !value.endsWith('T00:00')) Object.assign(options, { hour: '2-digit', minute: '2-digit', hour12: false, hourCycle: 'h23' });
  return new Intl.DateTimeFormat('ko-KR', options).format(date);
}

export function dateTimeInputValue(value?: string): string {
  if (!value) return '';
  return value.includes('T') ? value.slice(0, 16) : `${value.slice(0, 10)}T00:00`;
}

export function todayDateTimeInputValue(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T00:00`;
}

export function daysUntil(value?: string, reference = new Date()): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const deadline = new Date(value.includes('T') ? value : `${value}T23:59:59`);
  const remaining = deadline.getTime() - reference.getTime();
  return Math.floor(remaining / 86400000);
}

export function getJob(workspace: Workspace, application: Application): Job {
  return workspace.jobs.find((job) => job.id === application.jobId) || {
    id: application.jobId,
    company: '회사 미지정', role: '직무 미지정', deadline: '', url: '', description: '', skills: []
  };
}

export function statusClass(status: string): string {
  status = normalizedApplicationStatus(status);
  if (['탈락', '불합격', '포기', '마감'].includes(status)) return 'closed';
  if (status === '합격') return 'success';
  if (status === '전형 진행' || status === '결과 대기') return 'interview';
  if (status.includes('준비')) return 'writing';
  return 'default';
}

export function dateText(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : `${value} (${new Intl.DateTimeFormat('ko-KR', { weekday: 'short' }).format(date)})`;
}

export function isRejected(status: string): boolean {
  return status === "불합격" || status === "탈락";
}

export function matchesApplicationTab(status: string, tab: string): boolean {
  if (isRejected(status)) return tab === "불합격";
  return tab === "전체" || normalizedApplicationStatus(status) === tab;
}

export function scheduleWorkspace(workspace: Workspace): Workspace {
  const rejectedIds = new Set([...workspace.applications, ...workspace.archivedApplications].filter((item) => isRejected(item.status)).map((item) => item.jobId));
  const rejectedJobs = workspace.jobs.filter((job) => rejectedIds.has(job.id));
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
  return {
    ...workspace,
    applications: workspace.applications.filter((item) => !isRejected(item.status) && !rejectedIds.has(item.jobId)),
    jobs: workspace.jobs.filter((job) => !rejectedIds.has(job.id)),
    interviews: workspace.interviews.filter((item) => !rejectedJobs.some((job) => normalize(job.company) === normalize(item.company) && normalize(job.role) === normalize(item.role)))
  };
}
