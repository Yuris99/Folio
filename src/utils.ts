import type { Application, Job, Workspace } from './types';

export const applicationStatuses = ['관심', '지원 준비', '전형 진행', '결과 대기', '합격', '불합격'];

export function normalizedApplicationStatus(status: string): string {
  if (['합격'].includes(status)) return '합격';
  if (['탈락', '불합격'].includes(status)) return '불합격';
  if (['관심'].includes(status)) return '관심';
  if (['작성 중', '서류 준비', '지원 준비'].includes(status)) return '지원 준비';
  if (['처우 협의', '결과 대기'].includes(status)) return '결과 대기';
  return '전형 진행';
}

export const nextProcesses = ['서류 제출', '서류 결과', '인적성 검사', '코딩 테스트', '1차 면접', '2차 면접', '최종 면접', '처우 협의', '최종 결과', '없음'];

export function dateLabel(value?: string): string {
  if (!value) return '미정';
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
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

export function daysUntil(value?: string): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(value.includes('T') ? value : `${value}T00:00:00`).getTime() - today.getTime()) / 86400000);
}

export function getJob(workspace: Workspace, application: Application): Job {
  return workspace.jobs.find((job) => job.id === application.jobId) || {
    id: application.jobId,
    company: '회사 미지정', role: '직무 미지정', deadline: '', url: '', description: '', skills: []
  };
}

export function statusClass(status: string): string {
  status = normalizedApplicationStatus(status);
  if (status === '탈락' || status === '불합격') return 'closed';
  if (status === '합격') return 'success';
  if (status === '전형 진행' || status === '결과 대기') return 'interview';
  if (status.includes('준비')) return 'writing';
  return 'default';
}
