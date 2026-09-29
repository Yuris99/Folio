import type { Application, CareerGrade, Job, Profile } from './types';

// ---------------------------------------------------------------------------
// 지원 우선순위 = 지원 가치(100점) + 마감 보너스(최대 15점)
// 등급(최우선~낮음)은 지원 가치만으로 정하고, 정렬할 때만 마감 보너스를 더합니다.
// 원칙: 내 선호(직무선호도)는 내가 정하고, 객관적인 항목은 근거를 보고 매깁니다.
// ---------------------------------------------------------------------------

export type Level = 1 | 2 | 3 | 4 | 5;
export type CriterionKey = 'career' | 'preference' | 'compensation' | 'pass' | 'work';

// 5단계 → 배점 비율. 입력하지 않은 항목은 3단계(보통)로 계산합니다.
export const LEVEL_RATIO: Record<Level, number> = { 5: 1, 4: 0.85, 3: 0.65, 2: 0.4, 1: 0.15 };
export const DEFAULT_LEVEL: Level = 3;
export const CAREER_GRADES: CareerGrade[] = ['S', 'A', 'B', 'C', 'D'];
const GRADE_LEVEL: Record<CareerGrade, Level> = { S: 5, A: 4, B: 3, C: 2, D: 1 };

export interface PriorityCriterion {
  key: CriterionKey;
  label: string;
  weight: number;
  decidedBy: '나' | '근거';
  summary: string;
  levels: Record<Level, string>;
}

export const PRIORITY_CRITERIA: PriorityCriterion[] = [
  {
    key: 'career', label: '커리어 가치', weight: 30, decidedBy: '근거',
    summary: '이 경력이 원하는 진로로 이어지는가. 쌓이는 기술의 깊이, 직무의 실제 개발 비중, 이직 시 인정받는 정도.',
    levels: {
      5: '원하는 진로의 핵심 경력. 깊은 기술이 쌓이고 어디서든 인정받음',
      4: '원하는 방향과 가깝고 개발 역량이 확실히 쌓임',
      3: '쓸 만한 개발 경력이지만 방향이 조금 다름',
      2: '개발 비중이 낮거나 진로와 거리가 있음',
      1: '운영·관리 위주로 개발 경력으로 남기 어려움'
    }
  },
  {
    key: 'preference', label: '직무선호도', weight: 20, decidedBy: '나',
    summary: '내가 이 일을 실제로 얼마나 하고 싶은가. 회사 규모나 평판이 아니라 업무 자체만 봅니다.',
    levels: {
      5: 'S · 매우 하고 싶음. 조건이 조금 아쉬워도 이 일이라면 지원',
      4: 'A · 상당히 하고 싶음. 적극적으로 지원하고 싶음',
      3: 'B · 괜찮음. 충분히 일할 의향이 있음',
      2: 'C · 가능. 업무에 크게 끌리지는 않음',
      1: 'D · 별로 하고 싶지 않음. 다른 조건이 아주 좋아야 지원'
    }
  },
  {
    key: 'compensation', label: '연봉·보상', weight: 20, decidedBy: '근거',
    summary: '신입 초봉과 성과급·복지를 포함한 총보상. 전체 평균이 아니라 신입 기준, 가능하면 공식 자료로 판단합니다.',
    levels: {
      5: '동종 신입 중 최상위권',
      4: '업계 평균보다 확실히 높음',
      3: '업계 평균 수준',
      2: '평균보다 낮음',
      1: '크게 낮거나 불안정(계약직·인턴 전환 불확실 등)'
    }
  },
  {
    key: 'pass', label: '합격 가능성', weight: 20, decidedBy: '근거',
    summary: 'JD 요구사항과 내 실제 경험의 일치, 그리고 전형(코테·인적성·과제)이 내 강점과 맞는지.',
    levels: {
      5: '필수·우대 대부분 충족, 전형도 내 강점',
      4: '필수 충족에 관련 경험이 충분함',
      3: '지원 가능하지만 일부 요구사항과 차이가 있음',
      2: '기초 역량만 있고 관련 경험이 부족함',
      1: '필수 요건 미달'
    }
  },
  {
    key: 'work', label: '근무 조건', weight: 10, decidedBy: '근거',
    summary: '실제 근무지까지 편도 출퇴근 시간, 재택 여부. 근무지가 확실하지 않으면 비워 둡니다.',
    levels: {
      5: '편도 45분 이내 또는 재택 위주',
      4: '편도 45~60분',
      3: '편도 60~90분',
      2: '편도 90분 이상',
      1: '이사 필요'
    }
  }
];

export const DEADLINE_BONUS_RULES = [
  { label: 'D-day · D-1', bonus: 15 },
  { label: 'D-2 ~ D-3', bonus: 10 },
  { label: 'D-4 ~ D-7', bonus: 5 },
  { label: 'D-8 이후 · 상시 채용', bonus: 0 }
] as const;

export const PRIORITY_THRESHOLDS = { TOP: 85, ACTIVE: 70, REVIEW: 55, LATER: 40 } as const;

export function clampScore(value: unknown, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : 0;
}

function asLevel(value: unknown): Level | undefined {
  const parsed = Math.round(Number(value));
  return parsed >= 1 && parsed <= 5 ? parsed as Level : undefined;
}

// 예전 숫자 점수(0점 = 미입력)를 5단계로 옮깁니다.
function legacyLevel(...pairs: Array<[unknown, number]>): Level | undefined {
  const ratios = pairs.map(([score, max]) => Number(score) / max).filter((ratio) => Number.isFinite(ratio) && ratio > 0);
  if (!ratios.length) return undefined;
  const average = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
  return asLevel(Math.round(Math.min(1, average) * 4) + 1);
}

// 입력된 5단계 값. 입력하지 않았으면 undefined입니다.
export function priorityLevels(application: Application): Record<CriterionKey, Level | undefined> {
  return {
    career: asLevel(application.careerLevel) ?? legacyLevel([application.companyScore, 5]),
    preference: application.careerGrade ? GRADE_LEVEL[application.careerGrade] : undefined,
    compensation: asLevel(application.compensationLevel) ?? legacyLevel([application.compensationScore, 15]),
    pass: asLevel(application.passLevel) ?? legacyLevel([application.applicationFitScore, 25], [application.processScore, 10]),
    work: asLevel(application.workLevel) ?? legacyLevel([application.locationScore, 10])
  };
}

export function calculateDeadlineScore(deadline?: string, reference = new Date()): number {
  if (!deadline) return 0;
  const target = new Date(deadline.includes('T') ? deadline : `${deadline}T23:59:59`);
  if (Number.isNaN(target.getTime())) return 0;
  const today = new Date(reference); today.setHours(0, 0, 0, 0);
  const targetDay = new Date(target); targetDay.setHours(0, 0, 0, 0);
  const days = Math.round((targetDay.getTime() - today.getTime()) / 86400000);
  if (days < 0) return 0;
  if (days <= 1) return 15;
  if (days <= 3) return 10;
  if (days <= 7) return 5;
  return 0;
}

export function getPriorityBreakdown(application: Application, job: Job) {
  const levels = priorityLevels(application);
  const raw = Object.fromEntries(PRIORITY_CRITERIA.map((criterion) => [criterion.key, criterion.weight * LEVEL_RATIO[levels[criterion.key] ?? DEFAULT_LEVEL]])) as Record<CriterionKey, number>;
  // 항목 점수는 보기용으로 반올림하고, 합계는 반올림 전 값으로 한 번만 반올림합니다.
  const points = Object.fromEntries(Object.entries(raw).map(([key, point]) => [key, Math.round(point)])) as Record<CriterionKey, number>;
  const missing = PRIORITY_CRITERIA.filter((criterion) => !levels[criterion.key]).map((criterion) => criterion.label);
  const value = clampScore(Math.round(Object.values(raw).reduce((sum, point) => sum + point, 0)), 0, 100);
  const deadlineEligible = ['관심', '지원 준비', '작성 중', '서류 준비'].includes(application.status);
  const deadline = job.alwaysOpen || !deadlineEligible ? 0 : calculateDeadlineScore(job.deadline);
  // final: 등급을 정하는 지원 가치(100점). sortScore: 마감 보너스를 더한 정렬용 점수.
  return { levels, points, missing, value, deadline, final: value, sortScore: value + deadline };
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

// ---------------------------------------------------------------------------
// AI 평가 프롬프트: 위 기준을 그대로 옮겨 ChatGPT 등에 붙여 넣고, 답변의 JSON을 다시 읽습니다.
// ---------------------------------------------------------------------------

export interface PromptJob {
  company: string;
  role: string;
  location?: string;
  deadline?: string;
  alwaysOpen?: boolean;
  url?: string;
  description?: string;
}

const list = (items: Array<string | undefined>) => items.map((item) => item?.trim()).filter(Boolean).join(', ');

// ChatGPT 등에 붙여 넣을 공고 평가 프롬프트. 점수 기준은 priority.ts의 PRIORITY_CRITERIA를 그대로 씁니다.
export function buildPriorityPrompt(job: PromptJob, profile?: Partial<Profile>): string {
  const criteria = PRIORITY_CRITERIA.map((criterion) => [
    `### ${criterion.label} (${criterion.weight}점${criterion.decidedBy === '나' ? ' · 내가 결정' : ''})`,
    criterion.summary,
    ...([5, 4, 3, 2, 1] as Level[]).map((level) => `- ${level}: ${criterion.levels[level]}`)
  ].join('\n')).join('\n\n');
  const me = [
    `- 생활 거점: ${list([profile?.location, profile?.desiredLocation]) || '(적어 주세요)'}`,
    `- 희망 방향: ${list([profile?.target, profile?.role]) || '(적어 주세요)'}`,
    `- 주요 역량: ${list(profile?.skills || []) || '(적어 주세요)'}`,
    profile?.summary?.trim() ? `- 요약: ${profile.summary.trim()}` : ''
  ].filter(Boolean).join('\n');
  const deadline = job.alwaysOpen ? '상시 채용' : job.deadline || '미정';
  return `# 채용 공고 우선순위 평가

아래 공고를 내 기준으로 평가해줘. 직무명만 보지 말고 실제 업무(JD)를 기준으로, 확인된 사실만 근거로 써.

## 원칙
- 직무선호도(S~D)는 내가 정한다. 너는 예상 등급을 참고 의견으로만 준다.
- 나머지 항목은 공고와 공식 자료 등 근거를 보고 1~5단계로 매긴다.
- 근거가 부족하면 숫자를 지어내지 말고 null로 두고 무엇을 확인해야 하는지 적는다.
- 연봉은 전체 직원 평균이 아니라 신입 기준. 근무지가 확실하지 않으면 출퇴근 시간을 추정하지 않는다.
- 코테를 잘 본다는 이유만으로 합격 가능성을 과하게 올리지 않는다. JD와 실제 경험의 일치가 핵심이다.

## 나
${me}

## 평가 항목 (지원 가치 100점)
${criteria}

점수: 항목 배점 × 단계 비율(5=100%, 4=85%, 3=65%, 2=40%, 1=15%). 비운 항목은 3단계로 계산.
등급: ${PRIORITY_THRESHOLDS.TOP}+ 최우선 · ${PRIORITY_THRESHOLDS.ACTIVE}+ 적극 지원 · ${PRIORITY_THRESHOLDS.REVIEW}+ 지원 검토 · ${PRIORITY_THRESHOLDS.LATER}+ 후순위 · 그 아래 낮음
마감 보너스(정렬용, 점수와 별도): ${DEADLINE_BONUS_RULES.map((rule) => `${rule.label} +${rule.bonus}`).join(' · ')}

## 공고
- 회사: ${job.company}
- 직무: ${job.role}
- 근무지: ${job.location || '미확인'}
- 마감: ${deadline}
- 링크: ${job.url || '없음'}

${job.description?.trim() ? `본문:\n${job.description.trim()}` : '본문: (링크를 확인하거나 여기에 붙여 넣어 주세요)'}

## 출력
1. 직무 요약 (실제로 하는 일, 3~5문장)
2. 내 경험과의 연결 / 부족한 점
3. 항목별 단계와 근거 한 줄
4. 지원 전 확인할 것
5. 마지막에 아래 형식의 JSON 코드블록 하나 (모르는 항목은 null)

\`\`\`json
{"career": 4, "preference_suggestion": "A", "compensation": 3, "pass": 4, "work": null, "check": "지원 전 확인할 것 한 줄"}
\`\`\`
`;
}

export interface ParsedPriority {
  levels: Partial<Record<Exclude<CriterionKey, 'preference'>, Level | undefined>>;
  preferenceSuggestion?: CareerGrade;
  check?: string;
}

// AI 답변에서 마지막 JSON 블록을 찾아 5단계 값으로 읽습니다. 직무선호도는 제안만 받습니다.
export function parsePriorityResult(text: string): ParsedPriority | null {
  const blocks = [...text.matchAll(/\{[^{}]*\}/g)].map((match) => match[0]).reverse();
  for (const block of blocks) {
    try {
      const data = JSON.parse(block) as Record<string, unknown>;
      if (!['career', 'compensation', 'pass', 'work'].some((key) => key in data)) continue;
      const level = (value: unknown) => { const parsed = Math.round(Number(value)); return value !== null && parsed >= 1 && parsed <= 5 ? parsed as Level : undefined; };
      const grade = String(data.preference_suggestion || '').trim().toUpperCase();
      return {
        levels: { career: level(data.career), compensation: level(data.compensation), pass: level(data.pass), work: level(data.work) },
        preferenceSuggestion: ['S', 'A', 'B', 'C', 'D'].includes(grade) ? grade as CareerGrade : undefined,
        check: typeof data.check === 'string' ? data.check : undefined
      };
    } catch { /* 다음 블록 시도 */ }
  }
  return null;
}
