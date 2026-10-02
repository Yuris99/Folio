import type { DiscoveredJob } from './types';

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

export function dashboardRecommendations(items: DiscoveredJob[], now = Date.now()) {
  return items.filter(item => !item.hidden && !item.suppressed && !isClosedRecommendation(item, now))
    .sort((a, b) => recommendationScore(b) - recommendationScore(a) || (b.publishedAt || b.discoveredAt).localeCompare(a.publishedAt || a.discoveredAt))
    .slice(0, 3);
}
