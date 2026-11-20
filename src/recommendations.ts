import type { DiscoveredJob } from './types';

export const recommendationTabs = ['추천', '분석 완료', '등록함', '마감됨', '거절함'] as const;
export type RecommendationTab = (typeof recommendationTabs)[number];

export const rejectReasons = ['직무가 안 맞음', '경력 조건', '근무 지역', '회사·산업', '처우·고용 형태', '이미 지원함'] as const;
export const registerReasons = ['직무가 잘 맞음', '회사가 궁금함', '성장 기회', '조건이 좋음', '경력과 연결됨'] as const;

export function isClosedRecommendation(item: DiscoveredJob, now = Date.now()) {
  const deadline = item.deadline.includes('T') ? item.deadline : `${item.deadline}T23:59:59+09:00`;
  return item.closed || Boolean(item.deadline && Date.parse(deadline) < now);
}

export function isRegisteredRecommendation(item: DiscoveredJob) {
  return Boolean(item.savedJobId) || item.decision?.kind === 'registered';
}

export function recommendationScore(item: DiscoveredJob) {
  return item.analysisStale ? -1 : item.analysis?.score ?? -1;
}

export function recommendationScoreLabel(item: DiscoveredJob) {
  return item.analysisStale ? '재분석 필요' : !item.analysis ? '분석 대기' : item.analysis.score === null ? '정보 부족' : `적합도 ${item.analysis.score}`;
}

// Expired and already-decided postings leave the default queue; their own tabs keep them reviewable.
export function matchesRecommendationTab(item: DiscoveredJob, tab: RecommendationTab, now = Date.now()) {
  if (item.suppressed) return false;
  if (tab === '거절함') return item.hidden;
  if (item.hidden) return false;
  if (tab === '등록함') return isRegisteredRecommendation(item);
  if (tab === '마감됨') return isClosedRecommendation(item, now);
  if (isClosedRecommendation(item, now) || isRegisteredRecommendation(item)) return false;
  return tab === '추천' || Boolean(item.analysis && !item.analysisStale);
}

export function dashboardRecommendations(items: DiscoveredJob[], now = Date.now()) {
  return items.filter(item => matchesRecommendationTab(item, '추천', now))
    .sort((a, b) => recommendationScore(b) - recommendationScore(a) || (b.publishedAt || b.discoveredAt).localeCompare(a.publishedAt || a.discoveredAt));
}

// Highlighter class for a deadline: red pen within two days, marker stroke within a week.
export function deadlineMarkClass(deadline: string, now = Date.now()) {
  if (!deadline) return '';
  const end = Date.parse(deadline.includes('T') ? deadline : `${deadline}T23:59:59+09:00`);
  if (Number.isNaN(end) || end < now) return '';
  const days = (end - now) / 86400000;
  return days <= 2 ? 'mark-urgent' : days <= 7 ? 'mark-soon' : '';
}
