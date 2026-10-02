import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { EmptyState, PageHead } from '../components/Common';
import { Modal } from '../components/Modal';
import { isClosedRecommendation as isClosed, recommendationScoreLabel as scoreLabel } from '../recommendations';
import type { Mutation } from '../hooks/useFolio';
import type { DiscoveredJob, DiscoveryPreferences, DiscoveryStatus, View, Workspace } from '../types';

const sourceNames: Record<string, string> = { inthiswork: '인디스워크', saramin: '사람인', manual: '직접 추가' };
const qualityNames = { full: '본문 확보', partial: '상세 본문 확인 필요', image: '이미지 공고 · 본문 확인 필요' };
const confidenceNames = { low: '근거 부족', medium: '보통', high: '근거 충분' };
const tabs = ['전체', '분석 완료', '저장함', '숨김'] as const;
const split = (value: string) => value.split(/[,，\n]/).map(item => item.trim()).filter(Boolean);
function timeLabel(value?: string) {
  return value && !Number.isNaN(Date.parse(value)) ? new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '아직 수집하지 않음';
}

export function RecommendationsPage({ workspace, navigate, mutate }: { workspace: Workspace; navigate: (view: View) => void; mutate: Mutation }) {
  const [status, setStatus] = useState<DiscoveryStatus | null>(null);
  const [tab, setTab] = useState<(typeof tabs)[number]>('전체');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const [selectedId, setSelectedId] = useState(() => new URLSearchParams(window.location.search).get('posting') || '');
  const [settings, setSettings] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [packet, setPacket] = useState('');
  const [analysisJson, setAnalysisJson] = useState('');
  const authorizationId = new URLSearchParams(window.location.search).get('mcp_request') || '';
  const [authorization, setAuthorization] = useState<Awaited<ReturnType<typeof api.mcpAuthorization>> | null>(null);
  const [authorizationError, setAuthorizationError] = useState('');
  const state = status || workspace.discovery;
  const selected = state.items.find(item => item.id === selectedId && !item.suppressed && !isClosed(item));

  function closePosting() {
    setSelectedId('');
    const url = new URL(window.location.href);
    url.searchParams.delete('posting');
    window.history.replaceState(null, '', url);
  }

  useEffect(() => {
    const onPopState = () => setSelectedId(new URLSearchParams(window.location.search).get('posting') || '');
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = () => api.discoveryStatus().then(value => { if (active) setStatus(value); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : '공고 상태를 불러오지 못했습니다.'); });
    void refresh();
    // Background collection and ChatGPT writes become visible without a full reload.
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [workspace.discovery]);

  useEffect(() => {
    let active = true;
    if (authorizationId) void api.mcpAuthorization(authorizationId).then(value => { if (active) setAuthorization(value); }).catch(cause => { if (active) setAuthorizationError(cause instanceof Error ? cause.message : '연결 요청을 확인하지 못했습니다.'); });
    return () => { active = false; };
  }, [authorizationId]);

  useEffect(() => {
    let active = true; setPacket(''); setAnalysisJson('');
    if (selectedId) void api.jobAnalysisInput(selectedId).then(value => { if (active) setPacket(JSON.stringify(value, null, 2)); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : '분석 입력을 불러오지 못했습니다.'); });
    return () => { active = false; };
  }, [selectedId]);

  const eligible = state.items.filter(item => !item.suppressed && !isClosed(item));
  const matchesTab = (item: DiscoveredJob, value: (typeof tabs)[number]) => value === '숨김' ? item.hidden : !item.hidden && (value === '저장함' ? Boolean(item.savedJobId) : value === '분석 완료' ? Boolean(item.analysis && !item.analysisStale) : true);
  const visible = useMemo(() => eligible.filter(item => matchesTab(item, tab) && (!query.trim() || `${item.company} ${item.title} ${item.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())))
    .sort((a, b) => sort === 'fit' ? ((b.analysisStale ? -1 : b.analysis?.score ?? -1) - (a.analysisStale ? -1 : a.analysis?.score ?? -1)) : sort === 'deadline' ? (a.deadline || '9999').localeCompare(b.deadline || '9999') : (b.publishedAt || b.discoveredAt).localeCompare(a.publishedAt || a.discoveredAt)), [state.items, query, tab, sort]);

  async function perform<T>(label: string, action: () => Promise<T>, success?: (value: T) => void) {
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await mutate(label, action);
      setStatus(await api.discoveryStatus()); success?.(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '요청을 처리하지 못했습니다.'); }
    finally { setBusy(false); }
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setMessage('복사했습니다. ChatGPT에 붙여넣어 주세요.'); }
    catch { setError('복사 권한이 없습니다. 아래 내용을 직접 선택해 복사해 주세요.'); }
  }
  async function copyAnalysisRequest() {
    if (!selected) return;
    try { const latest = JSON.stringify(await api.jobAnalysisInput(selected.id), null, 2); setPacket(latest); await copy(latest); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '분석 요청을 불러오지 못했습니다.'); }
  }
  function clearAuthorization() {
    const url = new URL(window.location.href); url.searchParams.delete('mcp_request'); window.history.replaceState(null, '', url); setAuthorization(null); setAuthorizationError('');
  }
  async function authorize(approve: boolean) {
    if (!authorization) return;
    setBusy(true);
    try { const result = await api.approveMcpAuthorization(authorizationId, authorization.consentToken, approve); window.location.assign(result.redirectUrl); }
    catch (cause) { setAuthorizationError(cause instanceof Error ? cause.message : '연결을 완료하지 못했습니다.'); setBusy(false); }
  }
  async function importAnalysis() {
    if (!selected) return;
    let payload: unknown;
    try { payload = JSON.parse(analysisJson.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')); }
    catch { setError('ChatGPT가 반환한 JSON 전체를 붙여넣어 주세요.'); return; }
    await perform('분석 저장', () => api.saveJobFitAnalysis(selected.id, payload), () => { setAnalysisJson(''); setMessage('분석을 저장했습니다.'); });
  }

  return <>
    <PageHead kicker="JOB DISCOVERY" title="추천 공고" description="새 공고를 모으고, 내 커리어와 맞는 이유를 확인하세요." actions={<div className="page-head-actions"><button className="button" onClick={() => setAdding(true)}>+ 직접 추가</button><button className="button" onClick={() => setSettings(true)}>수집 설정</button><button className="button primary" disabled={busy || state.running} onClick={() => void perform('공고 수집', api.collectJobs, value => setMessage(value.sourceStatus.some(source => source.ok) ? `새 공고 ${value.added}개를 찾았습니다.` : '수집하지 못했습니다. 아래 사이트별 상태를 확인해 주세요.'))}>{busy || state.running ? '처리 중…' : '새 공고 찾기'}</button></div>} />
    <div className="discovery-overview"><div><span className={`discovery-dot ${state.preferences.enabled ? 'on' : ''}`} /><strong>{state.preferences.enabled ? `${state.preferences.intervalHours}시간마다 자동 수집` : '자동 수집 꺼짐'}</strong><small>최근 확인 · {timeLabel(state.lastCompletedAt)}</small></div><button className="text-link" onClick={() => navigate('jobs')}>공고보관함 →</button></div>
    {state.sourceStatus.length > 0 && <div className="discovery-source-report">{state.sourceStatus.map(source => <div key={source.source} className={source.ok ? '' : 'failed'}><strong>{sourceNames[source.source] || source.source}</strong><span>{source.ok ? `${source.fetched}개 확인 · 조건 일치 ${source.matched}개` : source.message}</span>{source.ok && source.message && <small>{source.message}</small>}<small>{timeLabel(source.checkedAt)}</small></div>)}</div>}
    {message && <p className="discovery-notice" role="status">{message}</p>}
    {error && <p className="discovery-notice error" role="alert">{error}</p>}
    <div className="discovery-toolbar"><div className="section-tabs discovery-tabs">{tabs.map(value => <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{value}<small>{eligible.filter(item => matchesTab(item, value)).length}</small></button>)}</div><label className="application-search"><span>⌕</span><input aria-label="추천 공고 검색" placeholder="회사·직무 검색" value={query} onChange={event => setQuery(event.target.value)} /></label><select aria-label="추천 공고 정렬" value={sort} onChange={event => setSort(event.target.value)}><option value="recent">최근 발견순</option><option value="fit">적합도순</option><option value="deadline">마감 임박순</option></select></div>
    <p className="discovery-caption">적합도는 공고와 경력의 일치 정도입니다. 마감된 공고와 이전 불합격·보관 기록은 추천에서 제외합니다.</p>
    {visible.length ? <div className="discovery-grid">{visible.map(item => <article className="card discovery-card" key={item.id}><button className="discovery-card-main" onClick={() => setSelectedId(item.id)}><div className="discovery-card-top"><span className="discovery-company">{item.company || '기업명 확인 필요'}</span><span className={`discovery-score ${item.analysis && !item.analysisStale && item.analysis.score !== null ? 'scored' : ''}`}>{scoreLabel(item)}</span></div><h2>{item.title}</h2><p className="discovery-meta">{[item.location || '지역 확인 필요', item.experience || '경력 조건 확인 필요'].join(' · ')}</p><div className="tag-row">{item.sources.map(source => <span className="tag" key={`${source.source}:${source.externalId}`}>{sourceNames[source.source] || source.source}</span>)}<span className={`tag ${item.contentQuality !== 'full' ? 'discovery-quality' : ''}`}>{qualityNames[item.contentQuality]}</span></div><p className="discovery-card-summary">{item.analysis?.summary || (item.description ? item.description.slice(0, 140) : '이미지 또는 원문에서 상세 조건을 확인해 주세요.')}</p>{!item.analysis && Boolean(item.matchedKeywords?.length) && <p className="discovery-keywords">커리어 일치 키워드 · {item.matchedKeywords?.slice(0, 5).join(', ')}</p>}<div className="discovery-card-bottom"><small>{item.deadline ? `${item.deadline} 마감` : item.alwaysOpen ? '상시 채용' : '마감일 확인 필요'}</small><small>{timeLabel(item.discoveredAt)} 발견</small></div></button><div className="discovery-card-actions"><a href={item.url} target="_blank" rel="noreferrer">원문 보기 ↗</a><button disabled={busy} onClick={() => void perform(item.hidden ? '숨김 해제' : '공고 숨김', () => api.hideDiscoveredJob(item.id, !item.hidden))}>{item.hidden ? '숨김 해제' : '숨김'}</button><button disabled={busy || Boolean(item.savedJobId)} onClick={() => void perform('공고 저장', () => api.saveDiscoveredJob(item.id), () => setMessage('공고보관함에 저장했습니다.'))}>{item.savedJobId ? '저장됨' : '관심 공고 저장'}</button></div></article>)}</div> : <EmptyState title={state.items.length ? '조건에 맞는 추천 공고가 없습니다.' : '내게 맞는 새 공고를 찾아보세요.'} description={state.items.length ? '검색어나 탭을 바꾸거나 수집 설정을 확인해 주세요.' : '수집 설정에서 희망 직무와 지역을 확인한 뒤 새 공고 찾기를 눌러 주세요. 다른 사이트의 공고도 직접 추가할 수 있습니다.'} action={<button className="button" onClick={() => setSettings(true)}>수집 설정 확인</button>} />}

    {settings && <DiscoverySettings status={status} preferences={state.preferences} busy={busy} onClose={() => setSettings(false)} onSave={value => void perform('수집 설정 저장', () => api.updateDiscoveryPreferences(value), () => { setSettings(false); setMessage('수집 설정을 저장했습니다.'); })} onCopy={text => void copy(text)} onDisconnect={() => void perform('ChatGPT 연결 해제', api.disconnectMcp)} />}
    {adding && <ManualPosting busy={busy} onClose={() => setAdding(false)} onSave={value => void perform('공고 추가', () => api.addDiscoveredJob(value), result => { setAdding(false); setSelectedId(result.id); })} />}
    {selected && <Modal title={selected.title} kicker={selected.company || 'JOB DETAILS'} wide onClose={closePosting}><div className="discovery-detail">
      <div className="discovery-detail-actions"><a className="button" href={selected.url} target="_blank" rel="noreferrer">원문 보기 ↗</a><button className="button primary" disabled={busy || Boolean(selected.savedJobId)} onClick={() => void perform('공고 저장', () => api.saveDiscoveredJob(selected.id))}>{selected.savedJobId ? '보관함에 저장됨' : '관심 공고 저장'}</button></div>
      {selected.contentQuality !== 'full' && <p className="discovery-notice">{qualityNames[selected.contentQuality]} · 현재 확보한 정보만으로는 적합도 점수를 매기기 어렵습니다.</p>}
      {selected.analysis ? <section className="discovery-analysis"><div className="section-head"><h3>{scoreLabel(selected)}</h3><span className="tag">{confidenceNames[selected.analysis.confidence]}</span></div>{selected.analysisStale && <p className="discovery-notice">공고 또는 커리어가 바뀌었습니다. 아래 분석을 다시 확인해 주세요.</p>}<p>{selected.analysis.summary}</p><h4>맞는 경력 근거</h4>{selected.analysis.evidence.length ? selected.analysis.evidence.map((row, index) => <div className="discovery-evidence" key={index}><strong>{row.claim}</strong><blockquote>{row.jobQuote}</blockquote><small>{row.careerFactIds.map(id => workspace.careerFacts.find(fact => fact.id === id)?.title || '이전 커리어 항목').join(' · ')}</small></div>) : <p className="discovery-caption">확인 가능한 경력 근거가 부족합니다.</p>}<AnalysisList title="부족한 조건" items={selected.analysis.gaps} /><AnalysisList title="지원 전 확인할 내용" items={selected.analysis.questions} /><small className="discovery-caption">{timeLabel(selected.analysis.analyzedAt)} 분석 · 점수는 합격 확률이 아닙니다.</small></section> : <div className="discovery-analysis"><h3>분석 대기</h3><p>ChatGPT에 분석을 요청하면 내 경력과 맞는 이유, 부족한 조건을 정리할 수 있습니다.</p></div>}
      <details className="discovery-copy-panel" open={!selected.analysis}><summary>ChatGPT에서 분석하기</summary><p>분석 요청을 복사해서 ChatGPT에 붙여넣고, 반환된 JSON을 아래에 넣어 주세요. 확인 완료된 커리어만 포함하며 연락처와 원본 파일은 보내지 않습니다.</p><button className="button" disabled={!packet} onClick={() => void copyAnalysisRequest()}>분석 요청 복사</button><details><summary>분석 요청 내용 확인</summary><textarea aria-label="분석 요청 내용" value={packet} readOnly rows={8} /></details><label>ChatGPT 분석 결과<textarea aria-label="ChatGPT 분석 결과 JSON" value={analysisJson} onChange={event => setAnalysisJson(event.target.value)} placeholder="분석 결과 JSON 전체를 붙여넣으세요." rows={7} /></label><button className="button primary" disabled={busy || !analysisJson.trim()} onClick={() => void importAnalysis()}>분석 결과 저장</button></details>
      <details className="discovery-original"><summary>수집한 공고 본문 · {qualityNames[selected.contentQuality]}</summary><pre>{selected.description || '텍스트 본문이 없습니다. 원문에서 확인해 주세요.'}</pre>{selected.sources.map(source => <a key={`${source.source}:${source.externalId}`} href={source.url} target="_blank" rel="noreferrer">{sourceNames[source.source] || source.source} 출처 ↗</a>)}</details>
      {error && <p className="discovery-notice error" role="alert">{error}</p>}{message && <p className="discovery-notice" role="status">{message}</p>}
    </div></Modal>}
    {(authorization || authorizationError) && <Modal title="ChatGPT와 Folio 연결" kicker="ACCOUNT CONNECTION" compact onClose={clearAuthorization}>{authorizationError && <p className="discovery-notice error" role="alert">{authorizationError}</p>}{authorization && <><p>ChatGPT가 이 Folio 계정에서 아래 작업을 할 수 있도록 허용합니다.</p><ul><li>확인 완료된 커리어 조회</li><li>추천 공고 조회와 적합도 분석 저장</li><li>새 공고 이벤트 구독</li></ul><p className="discovery-caption">연락처·원본 파일은 공유하지 않습니다. 수집 설정에서 언제든 연결을 해제할 수 있습니다.</p><div className="discovery-detail-actions"><button className="button" disabled={busy} onClick={() => void authorize(false)}>취소</button><button className="button primary" disabled={busy} onClick={() => void authorize(true)}>연결 허용</button></div></>}</Modal>}
  </>;
}

function AnalysisList({ title, items }: { title: string; items: string[] }) {
  return <><h4>{title}</h4>{items.length ? <ul>{items.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p className="discovery-caption">추가로 기록된 내용이 없습니다.</p>}</>;
}
function DiscoverySettings({ status, preferences, busy, onClose, onSave, onCopy, onDisconnect }: { status: DiscoveryStatus | null; preferences: DiscoveryPreferences; busy: boolean; onClose: () => void; onSave: (value: DiscoveryPreferences) => void; onCopy: (text: string) => void; onDisconnect: () => void }) {
  const [draft, setDraft] = useState(preferences);
  const [keywords, setKeywords] = useState(preferences.keywords.join(', '));
  const [exclude, setExclude] = useState(preferences.excludeKeywords.join(', '));
  const [locations, setLocations] = useState(preferences.locations.join(', '));
  return <Modal title="공고 수집 설정" kicker="DISCOVERY PREFERENCES" onClose={onClose}><form className="discovery-settings" onSubmit={event => { event.preventDefault(); onSave({ ...draft, keywords: split(keywords), excludeKeywords: split(exclude), locations: split(locations) }); }}>
    <p className="discovery-caption">저장된 희망 직무·지역을 처음 제안합니다. 키워드는 하나라도 포함된 공고를 찾으며, 빈 값은 전체를 뜻합니다.</p>
    <label>희망 직무·키워드<input value={keywords} onChange={event => setKeywords(event.target.value)} placeholder="예: 백엔드, Java, 신입" /></label>
    <label>제외 키워드<input value={exclude} onChange={event => setExclude(event.target.value)} placeholder="예: 파견, 영업" /></label>
    <label>희망 지역<input value={locations} onChange={event => setLocations(event.target.value)} placeholder="예: 서울, 경기 (쉼표로 구분)" /><small>지역 정보가 없는 공고는 포함하고 확인 필요로 표시합니다.</small></label>
    <label>경력 구분<select value={draft.experience} onChange={event => setDraft({ ...draft, experience: event.target.value as DiscoveryPreferences['experience'] })}><option value="any">전체</option><option value="entry">신입·인턴·경력 무관</option><option value="junior">주니어 (확인 가능한 최소 경력 3년 이하)</option></select></label>
    <fieldset><legend>수집 사이트</legend>{status?.sources.map(source => <label key={source.id} className="discovery-source-option"><span className="inline-check"><input type="checkbox" checked={draft.sources.includes(source.id)} disabled={!source.ready && !draft.sources.includes(source.id)} onChange={event => setDraft({ ...draft, sources: event.target.checked ? [...draft.sources, source.id] : draft.sources.filter(id => id !== source.id) })} /><strong>{source.name}</strong>{!source.ready && <span className="tag">설정 필요</span>}</span><small>{source.note}</small></label>)}{!status && <p>사이트 상태를 불러오는 중…</p>}</fieldset>
    <label className="inline-check"><input type="checkbox" checked={draft.enabled} onChange={event => setDraft({ ...draft, enabled: event.target.checked })} />새 공고 자동 수집</label>
    <label>수집 주기<select value={draft.intervalHours} onChange={event => setDraft({ ...draft, intervalHours: Number(event.target.value) })}>{[1, 3, 6, 12, 24].map(hour => <option key={hour} value={hour}>{hour}시간마다</option>)}</select></label>
    <button className="button primary" disabled={busy || !draft.sources.length}>설정 저장</button>
    {status?.mcp.allowed && <section className="discovery-connection"><h3>ChatGPT 자동 분석</h3><p>{!status?.mcp.configured ? '서버 연결 설정이 필요합니다.' : !status.mcp.connected ? 'ChatGPT 계정 연결 대기' : status.mcp.subscriptions ? '새 공고 분석 이벤트 구독 중' : '연결됨 · 자동 분석 설정 대기'}</p>{status?.mcp.connected && <small>구독 {status.mcp.subscriptions}개 · 이벤트 전달 대기 {status.mcp.pendingDeliveries}건</small>}{status?.mcp.lastDeliveredAt && <small>최근 이벤트 전달 · {timeLabel(status.mcp.lastDeliveredAt)} (분석 완료 여부는 공고에서 확인)</small>}{status?.mcp.failures.map((failure, index) => <p className="discovery-notice error" key={index}>{failure}</p>)}<details><summary>연결 방법</summary><p>ChatGPT 개발자 모드에서 Folio를 연결한 뒤 Work의 Cloud 대화에서 아래 요청을 전달하세요. 실제 사용 가능 여부는 계정과 워크스페이스 설정에 따라 확인해야 합니다.</p>{status?.mcp.endpoint && <><label>Folio 연결 주소<input readOnly value={status.mcp.endpoint} /></label><button type="button" className="button" onClick={() => onCopy(status.mcp.endpoint)}>주소 복사</button></>}<p className="discovery-prompt">Folio의 새 공고 이벤트를 구독해 줘. 공고가 오면 분석 입력을 읽고, 확인 완료된 커리어와 비교해서 적합도·근거·부족한 조건을 분석하고 Folio에 저장해 줘. 본문이나 경력이 부족하면 점수는 비워 줘.</p><button type="button" className="button" onClick={() => onCopy('Folio의 jobs.discovered 이벤트를 구독해 줘. 새 공고가 오면 각 postingId의 get_analysis_input을 읽고, 확인 완료된 커리어와 비교해서 적합도·근거·부족한 조건을 분석한 뒤 save_job_analysis로 Folio에 저장해 줘. 본문이 full이 아니거나 커리어가 부족하면 score=null로 작성해 줘.')}>자동 분석 요청 복사</button><p className="discovery-caption">별도 AI 분석 API 키를 사용하지 않습니다. ChatGPT 사용량은 소비합니다. 연결 전에도 공고 상세에서 분석 요청을 복사할 수 있습니다.</p></details>{status?.mcp.connected && <button type="button" className="button" disabled={busy} onClick={onDisconnect}>ChatGPT 연결 해제</button>}</section>}
  </form></Modal>;
}
function ManualPosting({ busy, onClose, onSave }: { busy: boolean; onClose: () => void; onSave: (value: { company: string; title: string; url: string; description: string; location: string }) => void }) {
  const [draft, setDraft] = useState({ company: '', title: '', url: '', description: '', location: '' });
  return <Modal title="공고 직접 추가" kicker="ADD JOB POSTING" onClose={onClose}><form className="discovery-settings" onSubmit={event => { event.preventDefault(); onSave(draft); }}><p className="discovery-caption">자소설·직행 등에서 찾은 공고의 URL과 본문을 붙여넣어 분석할 수 있습니다.</p><label>회사명<input value={draft.company} onChange={event => setDraft({ ...draft, company: event.target.value })} /></label><label>공고 제목<input required value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label><label>공고 URL<input required type="url" value={draft.url} onChange={event => setDraft({ ...draft, url: event.target.value })} /></label><label>근무 지역<input value={draft.location} onChange={event => setDraft({ ...draft, location: event.target.value })} /></label><label>공고 본문<textarea value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} rows={10} placeholder="담당 업무·자격 요건·우대 사항을 붙여넣어 주세요." /></label><button className="button primary" disabled={busy}>공고 추가</button></form></Modal>;
}

