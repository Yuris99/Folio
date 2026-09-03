import type { Application, CareerGrade, Job } from './types';

export const JOB_PREFERENCE_CONFIG: Record<CareerGrade, { score: number; label: string; description: string }> = {
  S: { score: 30, label: '매우 하고 싶음', description: '회사·연봉·지역이 조금 아쉬워도 이 직무라면 지원하고 싶은 수준. 업무 자체가 가장 끌리는 직무.' },
  A: { score: 26, label: '상당히 하고 싶음', description: '꽤 만족하면서 일할 수 있고 적극적으로 지원하고 싶은 직무. S만큼 최우선은 아니지만 선호도가 높음.' },
  B: { score: 21, label: '괜찮음', description: '가장 원하는 분야는 아니지만 충분히 일할 의향이 있는 정상적인 지원 대상. 회사·연봉·지역이 좋다면 매우 좋은 선택지가 될 수 있음.' },
  C: { score: 13, label: '가능', description: '업무 자체에 크게 끌리지는 않지만 개발 경력과 다른 조건을 고려하면 선택 가능한 직무.' },
  D: { score: 5, label: '별로 하고 싶지 않음', description: '직무 자체의 선호도가 낮음. 회사·연봉 등 다른 조건이 상당히 좋아야 지원하고 싶은 수준.' }
};
export const JOB_PREFERENCE_SCORE: Record<CareerGrade, number> = Object.fromEntries(Object.entries(JOB_PREFERENCE_CONFIG).map(([grade, config]) => [grade, config.score])) as Record<CareerGrade, number>;
export const CAREER_GRADE_SCORE = JOB_PREFERENCE_SCORE;
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
  const career = application.careerGrade ? JOB_PREFERENCE_SCORE[application.careerGrade] : 0;
  const fit = clampScore(application.applicationFitScore, 0, 25);
  const compensation = clampScore(application.compensationScore, 0, 15);
  const company = clampScore(application.companyScore, 0, 5);
  const location = clampScore(application.locationScore, 0, 10);
  const process = clampScore(application.processScore, 0, 10);
  const deadline = job.alwaysOpen ? 0 : calculateDeadlineScore(job.deadline);
  const base = career + fit + compensation + company + location + process + deadline;
  return { career, fit, compensation, company, location, process, deadline, base, final: clampScore(base, 0, 100) };
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
