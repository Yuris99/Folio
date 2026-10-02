import type { DiscoveredJob } from './types';

export const recommendationTabs = ['전체', '분석 완료', '저장함', '마감됨', '삭제함'] as const;
export type RecommendationTab = (typeof recommendationTabs)[number];

export function isClosedRecommendation(item: DiscoveredJob, now = Date.now()) {
  const deadline = item.deadline.includes('T') ? item.deadline : `${item.deadline}T23:59:59+09:00`;
  return item.closed || Boolean(item.deadline && Date.parse(deadline) < now);
}

export function recommendationScore(item: DiscoveredJob) {
  return item.analysisStale ? -1 : item.analysis?.score ?? -1;
}

export function recommendationScoreLabel(item: DiscoveredJob) {
  return item.analysisStale ? '재분석 필요' : !item.analysis ? '분석 대기' : item.analysis.score === null ? '정보 부족' : `적합도 ${item.analysis.score}`;
}

export function matchesRecommendationTab(item: DiscoveredJob, tab: RecommendationTab, now = Date.now()) {
  if (item.suppressed) return false;
  if (tab === '삭제함') return item.hidden;
  if (item.hidden) return false;
  if (tab === '전체') return true;
  if (tab === '마감됨') return isClosedRecommendation(item, now);
  if (isClosedRecommendation(item, now)) return false;
  return tab === '저장함' ? Boolean(item.savedJobId) : Boolean(item.analysis && !item.analysisStale);
}

export function dashboardRecommendations(items: DiscoveredJob[], now = Date.now()) {
  return items.filter(item => !item.hidden && !item.suppressed && !isClosedRecommendation(item, now))
    .sort((a, b) => recommendationScore(b) - recommendationScore(a) || (b.publishedAt || b.discoveredAt).localeCompare(a.publishedAt || a.discoveredAt));
}
