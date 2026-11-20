import { useEffect, useMemo, useState } from 'react';
import { api, botApiBase } from '../api';
import { EmptyState, PageHead } from '../components/Common';
import { DateInput } from '../components/DateInput';
import { Modal } from '../components/Modal';
import { PriorityEditor, type PriorityInput } from '../components/PriorityEditor';
import { RecommendationDecisionModal, type DecisionKind, type DecisionPayload } from '../components/RecommendationDecision';
import { dateLabel } from '../utils';
import { deadlineMarkClass, isClosedRecommendation as isClosed, isRegisteredRecommendation as isRegistered, matchesRecommendationTab, recommendationLevels, recommendationReason, recommendationScore, recommendationScoreLabel as scoreLabel, recommendationTabs as tabs } from '../recommendations';
import type { Mutation } from '../hooks/useFolio';
import type { BotTokenStatus, DiscoveredJob, DiscoveryStatus, View, Workspace } from '../types';

const qualityNames = { full: '본문 있음', partial: '본문 짧음 · 원문 확인 필요', image: '이미지 공고 · 원문 확인 필요' };
function timeLabel(value?: string) {
  return value && !Number.isNaN(Date.parse(value)) ? new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '';
}
function sourceLabel(item: DiscoveredJob) {
  if (item.recommendation?.by) return item.recommendation.by;
  const source = item.sources[0]?.source;
  return source === 'bot' ? '봇 추천' : source === 'manual' ? '직접 추가' : '이전 수집';
}

export function RecommendationsPage({ workspace, mutate }: { workspace: Workspace; navigate: (view: View) => void; mutate: Mutation }) {
  const [status, setStatus] = useState<DiscoveryStatus | null>(null);
  const [tab, setTab] = useState<(typeof tabs)[number]>('추천');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const [selectedId, setSelectedId] = useState(() => new URLSearchParams(window.location.search).get('posting') || '');
  const [adding, setAdding] = useState(false);
  const [botOpen, setBotOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deciding, setDeciding] = useState<{ item: DiscoveredJob; kind: DecisionKind } | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const items = status?.items || workspace.discovery.items;
  const selected = items.find(item => item.id === selectedId && !item.suppressed);

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
    setStatus(null);
    const refresh = () => api.discoveryStatus().then(value => { if (active) setStatus(value); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : '추천 공고를 불러오지 못했습니다.'); });
    void refresh();
    // Postings a bot adds appear without a full reload.
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [workspace.discovery]);

  const eligible = items.filter(item => !item.suppressed);
  const visible = useMemo(() => eligible.filter(item => matchesRecommendationTab(item, tab) && (!query.trim() || `${item.company} ${item.title} ${item.description} ${recommendationReason(item)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())))
    .sort((a, b) => sort === 'fit' ? recommendationScore(b) - recommendationScore(a) : sort === 'deadline' ? (a.deadline || '9999').localeCompare(b.deadline || '9999') : (b.publishedAt || b.discoveredAt).localeCompare(a.publishedAt || a.discoveredAt)), [items, query, tab, sort]);

  async function perform<T>(label: string, action: () => Promise<T>, success?: (value: T) => void) {
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await mutate(label, action);
      setStatus(await api.discoveryStatus()); success?.(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '요청을 처리하지 못했습니다.'); }
    finally { setBusy(false); }
  }

  function decidePosting(item: DiscoveredJob, value: DecisionPayload) {
    void perform(value.decision === 'rejected' ? '공고 거절' : '공고 등록', () => api.decideDiscoveredJob(item.id, value), () => {
      setDeciding(null);
      if (value.decision === 'rejected' && selectedId === item.id) closePosting();
      setMessage(value.decision === 'rejected' ? '거절함으로 옮겼습니다. 거절 이유는 봇이 다음 추천에 참고하며, 거절함에서 되돌릴 수 있습니다.' : '공고보관함에 등록했습니다. 추천 사유와 평가도 함께 옮겼습니다.');
    });
  }

  function restorePosting(item: DiscoveredJob) {
    void perform('거절 취소', () => api.restoreDiscoveredJob(item.id), () => setMessage('거절을 취소하고 추천 목록으로 되돌렸습니다.'));
  }

  function decisionActions(item: DiscoveredJob, inDetail = false) {
    const cls = inDetail ? 'button ' : '';
    if (item.hidden) return <button className={inDetail ? 'button' : ''} disabled={busy} onClick={() => restorePosting(item)}>거절 취소</button>;
    if (isRegistered(item)) return <span className={`decision-done ${inDetail ? 'in-detail' : ''}`}>✓ 공고보관함에 등록됨</span>;
    const label = `${item.company || '회사 미상'} · ${item.title}`;
    return <><button className={`${cls}discovery-delete`} disabled={busy} aria-label={`${label} 거절`} onClick={() => { setError(''); setDeciding({ item, kind: 'rejected' }); }}>거절</button>
      <button className={`${cls}${inDetail ? 'primary' : 'decision-register'}`} disabled={busy || isClosed(item)} aria-label={`${label} 등록`} onClick={() => { setError(''); setDeciding({ item, kind: 'registered' }); }}>등록</button></>;
  }

  return <>
    <PageHead title="추천 공고" description="봇이나 직접 넣은 추천 공고를 등록하거나 거절하세요. 거절·등록 이유는 봇이 다음 추천에 참고합니다." actions={<div className="page-head-actions"><button className="button" onClick={() => setBotOpen(true)}>봇 연결</button><button className="button primary" onClick={() => setAdding(true)}>+ 공고 추가</button></div>} />
    {message && <p className="discovery-notice" role="status">{message}</p>}
    {error && !deciding && !adding && <p className="discovery-notice error" role="alert">{error}</p>}
    <div className="discovery-toolbar"><div className="section-tabs discovery-tabs">{tabs.map(value => <button key={value} className={tab === value ? 'active' : ''} aria-pressed={tab === value} onClick={() => setTab(value)}>{value}<small>{eligible.filter(item => matchesRecommendationTab(item, value)).length}</small></button>)}</div><label className="application-search"><span aria-hidden="true">⌕</span><input aria-label="추천 공고 검색" placeholder="회사·직무·사유 검색" value={query} onChange={event => setQuery(event.target.value)} /></label><select aria-label="추천 공고 정렬" value={sort} onChange={event => setSort(event.target.value)}><option value="recent">최근 추가순</option><option value="fit">적합도순</option><option value="deadline">마감 임박순</option></select></div>
    <p className="discovery-caption">추천 탭에는 아직 결정하지 않은 진행 중 공고만 보입니다. 이전에 불합격하거나 보관한 공고는 추천에서 제외합니다.</p>
    {visible.length ? <div className="discovery-grid">{visible.map(item => { const reason = recommendationReason(item); const levels = recommendationLevels(item.recommendation); const score = scoreLabel(item); return <article className="card discovery-card" key={item.id}>
      <button className="discovery-card-main" onClick={() => setSelectedId(item.id)}>
        <div className="discovery-card-top"><span className="discovery-company">{item.company || '기업명 확인 필요'}</span>{score && <span className="discovery-score scored">{score}</span>}</div>
        <h2>{item.title}</h2><p className="discovery-meta">{[item.location || '지역 확인 필요', item.experience || '경력 조건 확인 필요'].join(' · ')}</p>
        <div className="tag-row">{isClosed(item) && <span className="tag discovery-closed">마감됨</span>}{item.hidden && <span className="tag discovery-closed">거절함</span>}<span className="tag">{sourceLabel(item)}</span></div>
        <p className="discovery-card-summary">{reason ? <><b className="recommend-label">추천 사유</b>{reason}</> : item.description ? item.description.slice(0, 140) : '원문에서 상세 조건을 확인해 주세요.'}</p>
        {levels.length > 0 && <p className="recommend-levels">{levels.map(row => <span key={row.label}>{row.label} <b>{row.level}</b></span>)}</p>}
        {item.decision && <DecisionNote item={item} />}<div className="discovery-card-bottom"><small>{item.deadline ? <span className={isClosed(item) ? '' : deadlineMarkClass(item.deadline)}>{dateLabel(item.deadline)} 마감</span> : item.alwaysOpen ? '상시 채용' : '마감일 확인 필요'}</small><small>{timeLabel(item.discoveredAt)} 추가</small></div>
      </button>
      <div className="discovery-card-actions"><a href={item.url} target="_blank" rel="noreferrer">원문 보기 ↗</a>
        {decisionActions(item)}
      </div>
    </article>; })}</div> : <EmptyState title={query.trim() ? `'${query.trim()}'에 맞는 공고가 없습니다.` : tab === '거절함' ? '거절한 공고가 없습니다.' : tab === '등록함' ? '등록한 공고가 없습니다.' : tab === '마감됨' ? '마감된 공고가 없습니다.' : '새 추천 공고가 없습니다.'} description={query.trim() ? '검색어를 바꾸거나 지워 보세요.' : tab === '추천' ? '봇을 연결하면 봇이 찾은 공고가 이곳에 들어옵니다. 직접 추가할 수도 있습니다.' : '추천 탭에서 공고를 등록하거나 거절하면 이곳에 모입니다.'} action={tab === '추천' && !query.trim() && <button className="button" onClick={() => setBotOpen(true)}>봇 연결하기</button>} />}

    {adding && <AddPosting workspace={workspace} busy={busy} error={error} onClose={() => { setAdding(false); setError(''); }} onSave={value => void perform('공고 추가', () => api.addDiscoveredJob(value), result => { setAdding(false); setSelectedId(result.id); })} />}
    {botOpen && <BotConnection initial={status?.bot} onClose={() => setBotOpen(false)} />}
    {selected && <Modal title={selected.title} kicker={selected.company || '공고 상세'} wide onClose={closePosting}><div className="discovery-detail">
      <div className="discovery-detail-actions"><a className="button" href={selected.url} target="_blank" rel="noreferrer">원문 보기 ↗</a>{decisionActions(selected, true)}</div>
      {isClosed(selected) && <p className="discovery-notice">마감된 공고입니다.</p>}{selected.decision && <DecisionNote item={selected} />}
      <section className="discovery-analysis"><div className="section-head"><h3>추천 사유</h3>{scoreLabel(selected) && <span className="discovery-score scored">{scoreLabel(selected)}</span>}</div>
        <p>{recommendationReason(selected) || '추천 사유가 없습니다.'}</p>
        {recommendationLevels(selected.recommendation).length > 0 && <dl className="recommend-level-list">{recommendationLevels(selected.recommendation).map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.level}</dd></div>)}</dl>}
        <small className="discovery-caption">{sourceLabel(selected)} · {timeLabel(selected.discoveredAt)} 추가 · 점수는 합격 확률이 아닙니다.</small>
      </section>
      <details className="discovery-original" open={!recommendationReason(selected)}><summary>공고 본문 · {qualityNames[selected.contentQuality] || '원문 확인 필요'}</summary><pre>{selected.description || '본문이 없습니다. 원문에서 확인해 주세요.'}</pre></details>
      {error && !deciding && <p className="discovery-notice error" role="alert">{error}</p>}{message && <p className="discovery-notice" role="status">{message}</p>}
    </div></Modal>}
    {deciding && <RecommendationDecisionModal item={deciding.item} kind={deciding.kind} busy={busy} error={error} onClose={() => setDeciding(null)} onSubmit={value => decidePosting(deciding.item, value)} />}
  </>;
}

function DecisionNote({ item }: { item: DiscoveredJob }) {
  const decision = item.decision;
  if (!decision || (decision.kind === 'rejected' && !item.hidden)) return null;
  const detail = [...decision.reasons, decision.note].filter(Boolean).join(' · ');
  return <p className={`decision-note ${decision.kind}`}><strong>{decision.kind === 'rejected' ? '거절 이유' : '등록 이유'}</strong>{detail || '이유를 남기지 않았어요.'}</p>;
}

const emptyLevels: PriorityInput = { careerGrade: '', careerLevel: 0, compensationLevel: 0, passLevel: 0, workLevel: 0 };

function AddPosting({ workspace, busy, error, onClose, onSave }: { workspace: Workspace; busy: boolean; error: string; onClose: () => void; onSave: (value: Parameters<typeof api.addDiscoveredJob>[0]) => void }) {
  const [draft, setDraft] = useState({ company: '', title: '', url: '', description: '', location: '', experience: '', deadline: '', reason: '' });
  const [levels, setLevels] = useState<PriorityInput>(emptyLevels);
  const set = (key: keyof typeof draft) => (event: { target: { value: string } }) => setDraft(current => ({ ...current, [key]: event.target.value }));
  return <Modal title="추천 공고 추가" kicker="봇이 찾았거나 직접 찾은 공고" wide onClose={onClose}><form className="discovery-settings" onSubmit={event => { event.preventDefault(); const { reason, ...posting } = draft; onSave({ ...posting, recommendation: { reason, careerGrade: levels.careerGrade || undefined, careerLevel: levels.careerLevel || undefined, compensationLevel: levels.compensationLevel || undefined, passLevel: levels.passLevel || undefined, workLevel: levels.workLevel || undefined } }); }}>
    <div className="add-posting-grid">
      <label>회사명<input value={draft.company} onChange={set('company')} autoComplete="organization" /></label>
      <label>공고 제목 <small>(필수)</small><input required value={draft.title} onChange={set('title')} /></label>
      <label className="span-2">공고 URL <small>(필수)</small><input required type="url" value={draft.url} onChange={set('url')} placeholder="https://" /></label>
      <label>근무 지역<input value={draft.location} onChange={set('location')} placeholder="예: 서울 강남" /></label>
      <label>경력 조건<input value={draft.experience} onChange={set('experience')} placeholder="예: 신입·경력 무관" /></label>
      <label>마감일<DateInput type="date" value={draft.deadline} onChange={set('deadline')} /></label>
    </div>
    <label>추천 사유<textarea value={draft.reason} onChange={set('reason')} rows={3} maxLength={2000} placeholder="예: Spring API 경험과 업무가 맞고, 서울 근무라 희망 조건과 같습니다." /></label>
    <fieldset className="add-posting-levels"><legend>5단계 평가 <small>(선택 · 등록 후 지원 건을 만들면 평가가 이어집니다)</small></legend>
      <PriorityEditor value={levels} onChange={setLevels} job={{ deadline: draft.deadline, alwaysOpen: false }} status="관심" profile={workspace.profile} description={draft.description} />
    </fieldset>
    <label>공고 본문<textarea value={draft.description} onChange={set('description')} rows={6} placeholder="담당 업무·자격 요건·우대 사항을 붙여넣어 주세요." /></label>
    {error && <p className="discovery-notice error" role="alert">{error}</p>}
    <div className="discovery-detail-actions"><button type="button" className="button" onClick={onClose}>취소</button><button className="button primary" disabled={busy}>{busy ? '추가 중…' : '공고 추가'}</button></div>
  </form></Modal>;
}

function BotConnection({ initial, onClose }: { initial?: BotTokenStatus; onClose: () => void }) {
  const [state, setState] = useState<BotTokenStatus | null>(initial || null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const base = botApiBase();
  useEffect(() => { if (!initial) void api.botToken().then(setState).catch(() => setError('연결 상태를 불러오지 못했습니다.')); }, [initial]);
  async function run(action: () => Promise<void>) { setBusy(true); setError(''); setNotice(''); try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : '처리하지 못했습니다.'); } finally { setBusy(false); } }
  async function copy(text: string, label: string) { try { await navigator.clipboard.writeText(text); setNotice(`${label}을 복사했습니다.`); } catch { setError('복사 권한이 없습니다. 직접 선택해 복사해 주세요.'); } }
  const example = JSON.stringify({ by: '그록봇', postings: [{ company: '회사명', title: '공고 제목', url: 'https://...', location: '서울', experience: '신입', deadline: '2026-12-31', description: '공고 본문', recommendation: { reason: '추천 사유', score: 80, careerLevel: 4, careerGrade: 'A', compensationLevel: 3, passLevel: 3, workLevel: 4 } }] }, null, 2);
  return <Modal title="봇 연결" kicker="봇이 Folio에 공고를 넣고, 등록·거절 기록을 읽어 가는 통로" onClose={onClose}><div className="discovery-settings bot-connection">
    <p className="discovery-caption">봇에게 아래 열쇠를 주면 봇이 추천 공고를 넣고, 내가 등록·거절한 이유와 확인된 경력을 읽어 다음 추천에 반영할 수 있습니다. 연락처·첨부 파일은 전달되지 않습니다.</p>
    <section className="bot-status"><strong>{state?.active ? '연결 열쇠 사용 중' : '연결 열쇠 없음'}</strong>{state?.active && <small>{state.prefix}… · {timeLabel(state.createdAt)} 생성{state.lastUsedAt ? ` · 최근 사용 ${timeLabel(state.lastUsedAt)}` : ' · 아직 사용 안 함'}</small>}</section>
    {token && <div className="bot-token"><label>새 연결 열쇠 <small>(이 창을 닫으면 다시 볼 수 없습니다)</small><input readOnly value={token} onFocus={event => event.currentTarget.select()} /></label><button type="button" className="button" onClick={() => void copy(token, '연결 열쇠')}>열쇠 복사</button></div>}
    <div className="discovery-detail-actions"><button type="button" className="button primary" disabled={busy} onClick={() => void run(async () => { const wasActive = state?.active; const created = await api.createBotToken(); setToken(created.token); setState(created); setNotice(wasActive ? '새 열쇠를 만들었습니다. 이전 열쇠는 더 이상 쓸 수 없습니다.' : '열쇠를 만들었습니다. 지금 복사해 봇에 넣어 주세요.'); })}>{state?.active ? '열쇠 새로 만들기' : '연결 열쇠 만들기'}</button>{state?.active && <button type="button" className="button danger" disabled={busy} onClick={() => void run(async () => { setState(await api.revokeBotToken()); setToken(''); setNotice('연결을 끊었습니다. 봇은 더 이상 접근할 수 없습니다.'); })}>연결 끊기</button>}</div>
    {notice && <p className="discovery-notice" role="status">{notice}</p>}{error && <p className="discovery-notice error" role="alert">{error}</p>}
    <details><summary>봇에게 알려 줄 사용법</summary>
      <p>요청 머리글에 <code>Authorization: Bearer 연결열쇠</code>를 넣습니다. 1분에 60번까지 요청할 수 있습니다.</p>
      <dl className="bot-endpoints"><div><dt>추천에 참고할 정보 읽기</dt><dd><code>GET {base}/context</code></dd></div><div><dt>추천 공고 넣기 (한 번에 50개까지)</dt><dd><code>POST {base}/postings</code></dd></div></dl>
      <p className="discovery-caption">평가는 1~5단계(직무선호도는 S·A·B·C·D), 점수는 0~100, 마감일은 2026-12-31 형식입니다. 같은 공고를 다시 보내면 새로 만들지 않고 내용을 갱신하며, 거절한 공고는 다시 살아나지 않습니다.</p>
      <pre className="bot-example">{example}</pre>
      <button type="button" className="button" onClick={() => void copy(`Folio 추천 봇 사용법\n- 머리글: Authorization: Bearer <연결열쇠>\n- 참고 정보: GET ${base}/context (확인된 경력, 등록·거절 이유, 이미 받은 공고)\n- 공고 넣기: POST ${base}/postings\n- 거절 이유와 비슷한 공고는 추천하지 말고, 등록 이유와 비슷한 공고를 우선 추천해 줘.\n- 요청 예시:\n${example}`, '사용법')}>사용법 복사</button>
    </details>
  </div></Modal>;
}
