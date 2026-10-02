import { useEffect, useState } from 'react';
import { api } from '../api';
import { dashboardRecommendations, recommendationScore, recommendationScoreLabel } from '../recommendations';
import type { Mutation } from '../hooks/useFolio';
import type { DiscoveredJob, DiscoveryState, View } from '../types';
import { dateLabel } from '../utils';

export function HomeRecommendations({ discovery, navigate, mutate }: { discovery: DiscoveryState; navigate: (view: View) => void; mutate: Mutation }) {
  const [latest, setLatest] = useState<DiscoveryState | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [lastRemovedId, setLastRemovedId] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    let refreshing = false;
    setLatest(null);
    const refresh = async () => {
      if (refreshing || document.hidden) return;
      refreshing = true;
      try {
        const value = await api.discoveryStatus();
        if (active) { setLatest(value); setError(false); }
      } catch { if (active) setError(true); }
      finally { refreshing = false; }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [discovery]);
  const state = latest || discovery;
  const items = dashboardRecommendations(state.items).filter(item => !removedIds.includes(item.id));

  async function removePosting(item: DiscoveredJob) {
    setBusy(true);
    try {
      await mutate('공고 삭제', () => api.deleteDiscoveredJob(item.id));
      setRemovedIds(ids => [...ids, item.id]);
      setLastRemovedId(item.id);
      setLatest(null);
      setMessage('삭제함으로 옮겼어요. 다음 수집에도 다시 나타나지 않아요.');
    } catch { /* The shared mutation banner shows the error. */ }
    finally { setBusy(false); }
  }

  async function undoRemoval() {
    setBusy(true);
    try {
      await mutate('공고 복구', () => api.restoreDiscoveredJob(lastRemovedId));
      setRemovedIds(ids => ids.filter(id => id !== lastRemovedId));
      setLastRemovedId('');
      setLatest(null);
      setMessage('공고를 복구했어요.');
    } catch { /* The shared mutation banner shows the error. */ }
    finally { setBusy(false); }
  }

  function openPosting(id: string) {
    const url = new URL(window.location.href);
    url.searchParams.set('posting', id);
    window.history.replaceState(null, '', url);
    navigate('recommendations');
  }

  return <section className="card home-recommendations" aria-labelledby="home-recommendations-title">
    <div className="section-head"><div><h2 id="home-recommendations-title">나에게 맞는 추천 공고 <span className="home-recommendation-count">{items.length}개</span></h2><small>지원 가능한 수집 공고 전체 · 적합도 높은 순</small></div><button className="text-button" onClick={() => navigate('recommendations')}>공고 관리 →</button></div>
    {message && <div className="home-recommendation-message" role="status"><span>{message}</span>{lastRemovedId && <button className="text-button" disabled={busy} onClick={() => void undoRemoval()}>되돌리기</button>}</div>}
    {items.length ? <div className="home-recommendation-grid">{items.map(item => <article className="home-recommendation-item" key={item.id}><button className="home-recommendation" onClick={() => openPosting(item.id)}>
      <div className="home-recommendation-top"><strong>{item.company || '회사 확인 필요'}</strong><span className={`home-fit ${recommendationScore(item) >= 0 ? 'analyzed' : ''}`}>{recommendationScoreLabel(item)}</span></div>
      <h3>{item.title}</h3>
      <small className="home-recommendation-meta">{[item.location, item.experience].filter(Boolean).join(' · ') || '근무 조건 확인 필요'}</small>
      <p>{item.analysisStale ? '공고나 커리어가 바뀌어 분석을 다시 확인해야 합니다.' : item.analysis?.summary || (item.matchedKeywords?.length ? `내 커리어와 일치하는 키워드: ${item.matchedKeywords.slice(0, 3).join(', ')}` : '공고를 열어 상세 조건과 분석 내용을 확인해 보세요.')}</p>
      <div className="home-recommendation-bottom"><span>{item.deadline ? `${dateLabel(item.deadline)} 마감` : item.alwaysOpen ? '상시 채용' : '마감일 확인 필요'}</span><span>공고 보기 →</span></div>
    </button><div className="home-recommendation-actions"><button className="home-recommendation-delete" disabled={busy} aria-label={`${item.company || '회사 미상'} · ${item.title} 추천 공고 삭제`} onClick={() => void removePosting(item)}>삭제</button></div></article>)}</div> : <div className="home-recommendation-empty"><div><strong>{state.running ? '새 공고를 찾고 있어요.' : '현재 조건에 맞는 추천 공고가 없어요.'}</strong><p>{state.preferences.enabled ? '새 공고가 수집되면 이곳에 보여드릴게요. 추천 공고에서 수집 조건을 확인할 수 있어요.' : '희망 직무와 지역을 설정하고 새 공고를 찾아보세요.'}</p></div><button className="button" onClick={() => navigate('recommendations')}>추천 공고 살펴보기</button></div>}
    {error && <p className="home-recommendation-error" role="status">최신 공고를 불러오지 못했어요. 잠시 후 다시 확인합니다.</p>}
  </section>;
}
