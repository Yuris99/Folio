import type { Application, Job, Workspace } from './types';

export const applicationStatuses = ['관심', '작성 중', '지원 완료', '서류 통과', '면접', '합격', '탈락'];

export function dateLabel(value?: string): string {
  if (!value) return '미정';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(date);
}

export function daysUntil(value?: string): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(`${value}T00:00:00`).getTime() - today.getTime()) / 86400000);
}

export function getJob(workspace: Workspace, application: Application): Job {
  return workspace.jobs.find((job) => job.id === application.jobId) || {
    id: application.jobId,
    company: '회사 미지정', role: '직무 미지정', deadline: '', url: '', description: '', skills: []
  };
}

export function statusClass(status: string): string {
  if (status === '탈락') return 'closed';
  if (status === '합격') return 'success';
  if (status === '면접') return 'interview';
  if (status.includes('작성')) return 'writing';
  return 'default';
}
