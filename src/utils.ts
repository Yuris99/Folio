import type { Application, ApplicationProcessStep, Job, Workspace } from './types';

export const applicationStatuses = ['관심', '지원 준비', '전형 진행', '결과 대기', '불합격'];

export function normalizedApplicationStatus(status: string): string {
  if (['탈락', '불합격'].includes(status)) return '불합격';
  if (['합격', '포기', '마감'].includes(status)) return '결과 대기';
  if (['관심'].includes(status)) return '관심';
  if (['작성 중', '서류 준비', '지원 준비'].includes(status)) return '지원 준비';
  if (['처우 협의', '결과 대기'].includes(status)) return '결과 대기';
  return '전형 진행';
}

export const nextProcesses = ['서류 마감', '서류 제출', '서류 결과', 'AI 역량검사', '인적성 검사', '코딩 테스트', '1차 면접', '2차 면접', '최종 면접', '처우 협의', '최종 결과', '없음'];

// '서류 마감' 단계는 공고 마감일과 같은 일정입니다. 일정에는 공고 마감 한 번만 보여 줍니다.
export function duplicatesJobDeadline(step: Pick<ApplicationProcessStep, 'name' | 'date'>, job?: Pick<Job, 'deadline'>): boolean {
  return step.name.trim() === '서류 마감' && Boolean(job?.deadline) && step.date.slice(0, 10) === job!.deadline.slice(0, 10);
}

// 지금 진행 중이거나 다음에 올 전형 단계
export function currentProcessStep(application: Application): ApplicationProcessStep | undefined {
  const steps = application.processSteps || [];
  return steps.find((step) => step.status === '진행 중') || steps.find((step) => step.status === '예정');
}

export const processStageGroups = ['서류 심사', '테스트', '면접', '최종 조율', '기타', '단계 미등록'] as const;
export type ProcessStageGroup = typeof processStageGroups[number];

// 회사마다 다른 단계 이름을 몇 개의 묶음으로 모읍니다. '최종 면접'은 면접, '코테'는 테스트로 묶입니다.
export function processStageGroup(application: Application): ProcessStageGroup {
  const name = currentProcessStep(application)?.name.trim() || application.nextProcess?.trim() || '';
  if (!name || name === '없음') return '단계 미등록';
  if (name.includes('면접') || /인터뷰|커피챗|PT|토론/i.test(name)) return '면접';
  if (/테스트|코테|인적성|적성|과제|시험|역량검사|역검|코딩/.test(name)) return '테스트';
  if (name.includes('서류')) return '서류 심사';
  if (/처우|최종|오퍼|연봉|입사|합격 발표|결과/.test(name)) return '최종 조율';
  return '기타';
}

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

export type DocumentOutcome = 'not-submitted' | 'pending' | 'passed' | 'failed' | 'unrecorded';

export const MILESTONE_STEP = 10;

// 제출한 원서: 관심·지원 준비를 지나 전형 진행·결과 대기·불합격으로 넘어간 지원
export function isSubmitted(application: Application): boolean {
  return !['관심', '지원 준비'].includes(normalizedApplicationStatus(application.status));
}

// 서류 결과는 사용자가 직접 기록합니다. 기록 없이 불합격 처리된 지원은 합격률 계산에서 뺍니다.
export function documentOutcome(application: Application): DocumentOutcome {
  if (!isSubmitted(application)) return 'not-submitted';
  if (application.documentResult === '합격') return 'passed';
  if (application.documentResult === '불합격') return 'failed';
  return isRejected(application.status) ? 'unrecorded' : 'pending';
}

export function allApplications(workspace: Pick<Workspace, 'applications' | 'archivedApplications'>): Application[] {
  const seen = new Set<string>();
  return [...workspace.applications, ...(workspace.archivedApplications || [])].filter((item) => !seen.has(item.id) && Boolean(seen.add(item.id)));
}

export function applicationStats(applications: Application[]) {
  const outcomes = applications.map(documentOutcome);
  const count = (outcome: DocumentOutcome) => outcomes.filter((item) => item === outcome).length;
  const submitted = outcomes.length - count('not-submitted');
  const passed = count('passed'), failed = count('failed');
  const decided = passed + failed;
  const nextMilestone = (Math.floor(submitted / MILESTONE_STEP) + 1) * MILESTONE_STEP;
  return {
    submitted, passed, failed, pending: count('pending'),
    passRate: decided ? Math.round((passed / decided) * 100) : null,
    milestone: Math.floor(submitted / MILESTONE_STEP) * MILESTONE_STEP,
    nextMilestone,
    milestoneProgress: Math.round(((submitted % MILESTONE_STEP) / MILESTONE_STEP) * 100)
  };
}

export function stageResultStats(applications: Application[]) {
  const stages = new Map<string, { name: string; passed: number; failed: number }>();
  for (const application of applications) for (const step of application.processSteps || []) {
    if (!step.result) continue;
    const name = step.name.trim();
    const stage = stages.get(name) || { name, passed: 0, failed: 0 };
    if (step.result === '합격') stage.passed += 1; else stage.failed += 1;
    stages.set(name, stage);
  }
  const order = (name: string) => { const index = nextProcesses.indexOf(name); return index < 0 ? nextProcesses.length : index; };
  return [...stages.values()].sort((a, b) => order(a.name) - order(b.name) || a.name.localeCompare(b.name, 'ko'));
}

// 최근 N주(월요일 시작) 동안 제출한 원서 수. 접수일이 없으면 등록일로 셉니다.
export function weeklySubmissions(applications: Application[], weeks = 12, reference = new Date()) {
  const start = new Date(reference); start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - (weeks - 1) * 7);
  const buckets = Array.from({ length: weeks }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index * 7); return { start: date, count: 0 }; });
  for (const application of applications) {
    if (!isSubmitted(application)) continue;
    const value = application.appliedAt || application.createdAt;
    if (!value) continue;
    const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
    const index = Math.floor((date.getTime() - start.getTime()) / (7 * 86400000));
    if (index >= 0 && index < weeks) buckets[index].count += 1;
  }
  return buckets;
}
