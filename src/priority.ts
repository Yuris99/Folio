import type { Application, CareerGrade, Job } from './types';

export const CAREER_GRADE_SCORE: Record<CareerGrade, number> = { S: 40, A: 34, B: 27, C: 19, D: 10 };
export const PRIORITY_THRESHOLDS = { TOP: 85, ACTIVE: 70, REVIEW: 55, LATER: 40 } as const;
export const CAREER_GRADES: CareerGrade[] = ['S', 'A', 'B', 'C', 'D'];

export function clampScore(value: unknown, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : 0;
}

export function calculateDeadlineScore(deadline?: string, reference = new Date()): number {
  if (!deadline) return 0;
  const target = new Date(deadline.includes('T') ? deadline : `${deadline}T23:59:59`);
  if (Number.isNaN(target.getTime())) return 0;
  const today = new Date(reference); today.setHours(0, 0, 0, 0);
  const targetDay = new Date(target); targetDay.setHours(0, 0, 0, 0);
  const days = Math.round((targetDay.getTime() - today.getTime()) / 86400000);
  if (days < 0) return 0;
  if (days <= 1) return 5;
  if (days <= 3) return 4;
  if (days <= 7) return 3;
  if (days <= 14) return 2;
  return 1;
}

export function getPriorityBreakdown(application: Application, job: Job) {
  const career = application.careerGrade ? CAREER_GRADE_SCORE[application.careerGrade] : 0;
  const fit = clampScore(application.applicationFitScore, 0, 20);
  const company = clampScore(application.companyScore, 0, 15);
  const location = clampScore(application.locationScore, 0, 10);
  const process = clampScore(application.processScore, 0, 10);
  const deadline = calculateDeadlineScore(job.deadline);
  const adjustment = clampScore(application.priorityAdjustment, -10, 10);
  const base = career + fit + company + location + process + deadline;
  return { career, fit, company, location, process, deadline, adjustment, base, final: clampScore(base + adjustment, 0, 100) };
}

export function getPriorityLabel(score: number): '최우선' | '적극 지원' | '지원 검토' | '후순위' | '낮음' {
  if (score >= PRIORITY_THRESHOLDS.TOP) return '최우선';
  if (score >= PRIORITY_THRESHOLDS.ACTIVE) return '적극 지원';
  if (score >= PRIORITY_THRESHOLDS.REVIEW) return '지원 검토';
  if (score >= PRIORITY_THRESHOLDS.LATER) return '후순위';
  return '낮음';
}

export function priorityClass(score: number): 'top' | 'active' | 'review' | 'later' | 'low' {
  if (score >= PRIORITY_THRESHOLDS.TOP) return 'top';
  if (score >= PRIORITY_THRESHOLDS.ACTIVE) return 'active';
  if (score >= PRIORITY_THRESHOLDS.REVIEW) return 'review';
  if (score >= PRIORITY_THRESHOLDS.LATER) return 'later';
  return 'low';
}

export function isClosedApplication(status: string): boolean {
  return ['불합격', '탈락', '포기', '마감'].includes(status);
}
