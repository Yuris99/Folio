const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const d = require('./lib/job-discovery');
const { createMcpService } = require('./lib/folio-mcp');
const { isPublicAddress, publicRequest } = require('./lib/public-http');

const body = '담당 업무: Java와 Spring으로 API를 개발합니다. 자격 요건: Java 프로젝트 경험과 SQL 이해가 필요합니다. 우대 사항: Docker 운영 경험과 팀 협업을 우대합니다. 서비스 개선 경험과 장애 해결 과정에 대해 구체적으로 설명해 주세요.';
const categories = [{ id: 1, name: '신입/인턴' }, { id: 2, name: '주니어경력' }, { id: 3, name: '취업토크' }];
const post = (id = 1, extra = {}) => ({ id, date_gmt: new Date().toISOString().slice(0, 19), modified_gmt: new Date().toISOString().slice(0, 19), link: `https://inthiswork.com/archives/${id}`, title: { rendered: '테스트 기업｜Java 개발자' }, content: { rendered: `<p>${body}</p><a href="https://jobs.example.com/${id}">지원하러 가기</a>` }, categories: [1], ...extra });
function workspace() {
  return { profile: { role: 'Java', desiredLocation: '' }, jobs: [], applications: [], archivedApplications: [],
    careerFacts: [{ id: 'fact-1', category: 'project', title: 'API 프로젝트', description: 'Java API 개발', skills: ['Java', 'Spring'], status: 'verified', sensitive: false },
      { id: 'review', category: 'experience', title: '미확인 경력', status: 'review', sensitive: false, skills: ['Python'] },
      { id: 'private', category: 'profile', title: '전화번호', status: 'verified', sensitive: true, skills: [] }] };
}
function analysisPayload(w, item) {
  return { format: 'folio-job-analysis', version: 1, postingId: item.id, contextVersion: d.analysisContext(w, item).contextVersion,
    analysis: { score: 76, confidence: 'medium', summary: 'Java 프로젝트가 직무와 연결됩니다.', evidence: [{ claim: 'Java 개발 경험', careerFactIds: ['fact-1'], jobQuote: 'Java와 Spring으로 API를 개발합니다.' }], gaps: ['운영 경험 추가 확인'], questions: [], matchedSkills: ['Java'], missingSkills: ['Docker'], sourceUrls: [item.url] } };
}

test('public source parser preserves text, original links and image uncertainty', () => {
  const items = d.parseInthiswork([post(), post(2, { content: { rendered: '<a href="https://jobs.example.com/2"><img src="x"></a>' } })], categories);
  assert.equal(items[0].company, '테스트 기업'); assert.equal(items[0].title, 'Java 개발자');
  assert.equal(items[0].url, 'https://jobs.example.com/1'); assert.equal(items[0].contentQuality, 'full');
  assert.equal(items[1].contentQuality, 'image'); assert.equal(items[1].description, '');
  assert.equal(d.plainText('<script>doBad()</script><p>A &amp; B</p>'), 'A & B');
  assert.throws(() => d.parseInthiswork({ error: 'blocked' }, categories));
});
test('Saramin is metadata-only and keeps close and experience fields', () => {
  const item = d.parseSaramin({ jobs: { job: [{ id: 5, active: 1, url: 'https://saramin.co.kr/job?id=5', company: { name: { name: '회사' } }, position: { title: '백엔드', location: { name: '서울' }, 'experience-level': { name: '경력 5년', min: 5 } }, 'close-type': { code: '2' } }] } })[0];
  assert.equal(item.company, '회사'); assert.equal(item.contentQuality, 'partial'); assert.equal(item.minExperience, 5); assert.equal(item.alwaysOpen, true);
  assert.deepEqual(d.parseSaramin({ jobs: { count: 0 } }), []);
});
test('preferences retain uncertainty and exclude explicit mismatches', () => {
  const prefs = d.normalizePreferences({ keywords: ['Java'], excludeKeywords: ['파견'], locations: ['서울'], experience: 'entry', sources: ['inthiswork', 'unknown'] });
  const item = d.parseInthiswork([post()], categories)[0];
  assert.equal(d.matchesPreferences(item, prefs), true);
  assert.equal(d.matchesPreferences({ ...item, location: '부산' }, prefs), false);
  assert.equal(d.matchesPreferences({ ...item, title: 'Java 파견' }, prefs), false);
  assert.equal(d.matchesPreferences({ ...item, experience: '경력 5년' }, prefs), false);
  assert.deepEqual(prefs.sources, ['inthiswork']);
});
test('dedupe preserves hidden state, different cycles and richer body', () => {
  const items = [], raw = d.parseInthiswork([post()], categories)[0];
  const first = d.mergePosting(items, raw).item; first.hidden = true;
  assert.equal(d.mergePosting(items, { ...raw, contentQuality: 'partial', description: 'metadata' }).added, false);
  assert.equal(first.description, raw.description); assert.equal(first.hidden, true);
  const second = { ...raw, url: 'https://jobs.example.com/2', sources: [{ source: 'inthiswork', externalId: '2', url: 'https://inthiswork.com/archives/2' }], deadline: '2027-02-01' };
  assert.equal(d.mergePosting(items, second).added, true); assert.equal(items.length, 2);
  const same = { ...raw, sources: [{ source: 'saramin', externalId: '8', url: 'https://saramin.co.kr/8' }], url: `${raw.url}?utm_source=other` };
  assert.equal(d.mergePosting(items, same).added, false); assert.equal(first.sources.length, 2);
  const otherRole = { ...raw, title: '디자이너', sources: [{ source: 'inthiswork', externalId: '3', url: 'https://inthiswork.com/archives/3' }] };
  assert.equal(d.mergePosting(items, otherRole).added, true, 'shared careers landing page is not a vacancy ID');
});
test('analysis uses verified facts and validates evidence, stale input and missing data', () => {
  const w = workspace(), item = d.mergePosting(d.ensureDiscovery(w).items, d.parseInthiswork([post()], categories)[0]).item;
  const packet = d.analysisPacket(w, item);
  assert.deepEqual(packet.career.facts.map(f => f.id), ['fact-1']);
  const valid = analysisPayload(w, item); assert.equal(d.validateAnalysis(w, item, valid).score, 76);
  assert.throws(() => d.validateAnalysis(w, item, { ...valid, analysis: { ...valid.analysis, evidence: [{ ...valid.analysis.evidence[0], careerFactIds: ['review'] }] } }), /INVALID_ANALYSIS_EVIDENCE/);
  assert.throws(() => d.validateAnalysis(w, item, { ...valid, analysis: { ...valid.analysis, evidence: [{ ...valid.analysis.evidence[0], jobQuote: '없는 자격 조건' }] } }), /INVALID_ANALYSIS_EVIDENCE/);
  w.careerFacts[0].description = '변경된 경력'; assert.throws(() => d.validateAnalysis(w, item, valid), /STALE_ANALYSIS/);
  item.contentQuality = 'image'; const missing = analysisPayload(w, item);
  assert.throws(() => d.validateAnalysis(w, item, missing), /INSUFFICIENT_ANALYSIS_DATA/);
  missing.analysis.score = null; assert.equal(d.validateAnalysis(w, item, missing).score, null);
});
test('saved jobs are idempotent and rejection/archive suppress recommendations', () => {
  const w = workspace(), item = d.mergePosting(d.ensureDiscovery(w).items, d.parseInthiswork([post()], categories)[0]).item;
  const job = d.savePosting(w, item); assert.equal(d.savePosting(w, item).id, job.id); assert.equal(w.jobs.length, 1);
  assert.equal(w.applications.length, 0);
  assert.equal(job.discoveryPostingId,item.id);
  w.applications.push({ id: 'a', jobId: job.id, status: '불합격' }); assert.equal(d.postingView(w, item).suppressed, true);
  w.applications = []; w.archivedApplications.push({ id: 'a', jobId: job.id, status: '관심' }); assert.equal(d.postingView(w, item).suppressed, true);
});
test('known postings are rechecked when the source moves them to a closed category', async () => {
  const w=workspace(), user={id:'u',workspace:w}, db={users:{u:user}};
  const item=d.mergePosting(d.ensureDiscovery(w).items,d.parseInthiswork([post()],categories)[0]).item;
  const service=d.createDiscoveryService({getDb:()=>db,save(){},request:async url=>({status:200,body:JSON.stringify(url.includes('/categories?')?[...categories,{id:4,name:'▶마감/비공개'}]:url.includes('include=')?[post(1,{categories:[4]})]:[])})});
  await service.collect(user); assert.equal(item.closed,true); assert.equal(w.discovery.items.length,1);
});
test('optional closure-check failure does not discard newly collected postings', async () => {
  const w=workspace(),user={id:'u',workspace:w},db={users:{u:user}};
  d.mergePosting(d.ensureDiscovery(w).items,d.parseInthiswork([post(1)],categories)[0]);
  const service=d.createDiscoveryService({getDb:()=>db,save(){},request:async url=>url.includes('include=')?{status:429,body:''}:{status:200,body:JSON.stringify(url.includes('/categories?')?categories:[post(2)])}});
  const result=await service.collect(user);assert.equal(result.added,1);assert.equal(result.sourceStatus[0].ok,true);assert.match(result.sourceStatus[0].message,/다음 수집/);assert.equal(w.discovery.items.length,2);
});
test('collection isolates failures, avoids duplicate events and resumes automatic settings', async () => {
  const w = workspace(), user = { id: 'u1', workspace: w }, db = { users: { u1: user } }, events = [];
  const state = d.ensureDiscovery(w); state.preferences.sources = ['inthiswork', 'saramin'];
  const service = d.createDiscoveryService({ getDb: () => db, save() {}, onDiscovered: (_u, ids) => events.push(ids), request: async url => ({ status: 200, body: JSON.stringify(url.includes('/categories?') ? categories : [post()]) }) });
  const first = await service.collect(user); assert.equal(first.added, 1); assert.equal(first.sourceStatus[0].ok, true); assert.equal(first.sourceStatus[1].ok, false); assert.equal(events.length, 1);
  assert.equal((await service.collect(user, true)).added, 0); assert.equal(events.length, 1);
  state.preferences.enabled = true; state.nextRunAt = ''; state.lastRunAt = '';
  await service.tick(); assert.ok(state.nextRunAt); assert.equal(state.running, false);
  const failed = d.createDiscoveryService({ getDb: () => db, save() {}, request: async () => ({ status: 429, body: '' }) });
  assert.equal((await failed.collect(user, true)).sourceStatus[0].ok, false); assert.equal(state.items.length, 1);
});
test('outbound requests reject private, metadata and encoded local addresses', async () => {
  for (const value of ['127.0.0.1', '10.1.1.1', '172.16.1.1', '169.254.169.254', '192.168.1.1', '100.64.0.1', '::1', '::ffff:127.0.0.1', '2001:db8::1', '2002:7f00:1::1']) assert.equal(isPublicAddress(value), false, value);
  assert.equal(isPublicAddress('8.8.8.8'), true);
  assert.equal(isPublicAddress('192.0.78.248'), true, 'WordPress public hosting subnet');
  assert.equal(isPublicAddress('2001:0db8:0000::1'), false, 'expanded documentation address');
  await assert.rejects(publicRequest('https://2130706433/'), /PRIVATE_DESTINATION/);
  await assert.rejects(publicRequest('http://example.com/'), /INVALID_PUBLIC_URL/);
});

test('MCP OAuth, account isolation, signed events, retry, persistence and revoke', async () => {
  const w = workspace(), user = { id: 'u1', email: 'owner@example.com', workspace: w }, other = { id: 'u2', email: 'other@example.com', workspace: workspace() }, blocked = { id: 'u3', email: 'blocked@example.com', workspace: workspace() }, db = { users: { u1: user, u2: other, u3: blocked } };
  const item = d.mergePosting(d.ensureDiscovery(w).items, d.parseInthiswork([post()], categories)[0]).item;
  const requests = []; let deliveryStatus = 502;
  const publicOrigin = 'https://mcp.folio.example', endpoint = `${publicOrigin}/api/v1/mcp`, appOrigin = 'https://folio.example';
  const callback = 'https://chatgpt.com/connector_platform_oauth_redirect';
  const send = (res, status, value, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', ...headers }); res.end(JSON.stringify(value)); };
  const options = { getDb: () => db, save() {}, send, appOrigin, publicOrigin, enabled: true, allowedEmails: [' OWNER@EXAMPLE.COM ', other.email], request: async (url, opts) => {
    requests.push({ url, ...opts }); const value = JSON.parse(opts.body);
    return { status: value.type === 'verification' ? 200 : deliveryStatus, body: JSON.stringify(value.type === 'verification' ? { challenge: value.challenge } : {}) };
  } };
  let mcp = createMcpService(options);
  const server = http.createServer(async (req, res) => { try { await mcp.handle(req, res, new URL(req.url, 'http://localhost')); } catch (e) { send(res, 400, { error: e.message }); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const base = `http://127.0.0.1:${server.address().port}`;
  async function request(route, method = 'GET', value, bearer = '') {
    const res = await fetch(`${base}${route}`, { method, redirect: 'manual', headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) }, body: value === undefined ? undefined : JSON.stringify(value) });
    const data = await res.text(); return { res, data: data ? JSON.parse(data) : null };
  }
  async function link(account) {
    const registered = await request('/api/v1/mcp/oauth/register', 'POST', { redirect_uris: [callback], token_endpoint_auth_method: 'none' });
    assert.equal(registered.res.status, 201); const clientId = registered.data.client_id;
    const verifier = crypto.randomBytes(48).toString('base64url'), challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const query = new URLSearchParams({ client_id: clientId, redirect_uri: callback, response_type: 'code', resource: endpoint, state: 'test-state', code_challenge: challenge, code_challenge_method: 'S256' });
    const authorized = await request(`/api/v1/mcp/oauth/authorize?${query}`); assert.equal(authorized.res.status, 302);
    const id = new URL(authorized.res.headers.get('location')).searchParams.get('mcp_request');
    const info = mcp.consentInfo(account, id), approved = mcp.consent(account, id, { consentToken: info.consentToken, approve: true });
    const redirect = new URL(approved.redirectUrl); assert.equal(redirect.searchParams.get('iss'), publicOrigin); assert.equal(redirect.searchParams.get('state'), 'test-state');
    const p = { grant_type: 'authorization_code', client_id: clientId, redirect_uri: callback, code: redirect.searchParams.get('code'), resource: endpoint, code_verifier: verifier };
    const bad = await request('/api/v1/mcp/oauth/token', 'POST', { ...p, code_verifier: 'x'.repeat(43) }); assert.equal(bad.data.error, 'invalid_grant');
    const token = await request('/api/v1/mcp/oauth/token', 'POST', p); assert.equal(token.res.status, 200);
    assert.equal((await request('/api/v1/mcp/oauth/token', 'POST', p)).data.error, 'invalid_grant');
    return { ...token.data, clientId };
  }
  let rpcId = 1;
  const rpc = async (token, method, params) => (await request('/api/v1/mcp', 'POST', { jsonrpc: '2.0', id: rpcId++, method, params }, token)).data;
  try {
    const unauthenticated = await request('/api/v1/mcp', 'POST', { jsonrpc: '2.0', id: 1, method: 'tools/list' });
    assert.equal(unauthenticated.res.status, 401); assert.match(unauthenticated.res.headers.get('www-authenticate'), /resource_metadata/);
    const invalidClient = await request('/api/v1/mcp/oauth/register', 'POST', { redirect_uris: ['https://attacker.example/callback'] }); assert.equal(invalidClient.res.status, 400);
    const metadata = await request('/.well-known/oauth-authorization-server'); assert.deepEqual(metadata.data.code_challenge_methods_supported, ['S256']);
    assert.equal(mcp.status(user).allowed, true);
    assert.equal(mcp.status(blocked).allowed, false);
    assert.equal(mcp.status(blocked).endpoint, '');
    await assert.rejects(link(blocked), /ACCOUNT_NOT_ALLOWED/);
    const first = await link(user), second = await link(other);
    assert.equal((await rpc(first.access_token, 'server/discover')).result.supportedVersions[0], '2026-07-28');
    assert.equal((await rpc(first.access_token, 'tools/list')).result.tools.length, 4);
    const career = await rpc(first.access_token, 'tools/call', { name: 'get_verified_career', arguments: {} }); assert.deepEqual(career.result.structuredContent.facts.map(f => f.id), ['fact-1']);
    const denied = await rpc(second.access_token, 'tools/call', { name: 'get_analysis_input', arguments: { postingId: item.id } }); assert.equal(denied.result.isError, true);
    const input = await rpc(first.access_token, 'tools/call', { name: 'get_analysis_input', arguments: { postingId: item.id } }); assert.equal(input.result.structuredContent.posting.id, item.id);
    const saved = await rpc(first.access_token, 'tools/call', { name: 'save_job_analysis', arguments: analysisPayload(w, item) }); assert.ok(saved.result.structuredContent.analyzedAt);
    item.hidden=true;
    const excluded=await rpc(first.access_token,'tools/call',{name:'get_analysis_input',arguments:{postingId:item.id}});assert.equal(excluded.result.isError,true);assert.match(excluded.result.content[0].text,/NOT_ELIGIBLE/);
    item.hidden=false;
    const secret = `whsec_${crypto.randomBytes(32).toString('base64')}`;
    const subscribed = await rpc(first.access_token, 'events/subscribe', { name: 'jobs.discovered', arguments: {}, delivery: { mode: 'webhook', url: 'https://receiver.example/callback', secret } }); assert.ok(subscribed.result.id);
    mcp.enqueue(user, [item.id]); await mcp.flush(); assert.equal(db.mcp.outbox[0].attempts, 1);
    const eventId = db.mcp.outbox[0].payload.eventId; db.mcp.outbox[0].nextAttemptAt = 0;
    mcp = createMcpService(options); assert.equal(mcp.status(user).subscriptions, 1);
    deliveryStatus = 200; await mcp.flush(); assert.equal(db.mcp.outbox.length, 0); assert.ok(mcp.status(user).lastDeliveredAt);
    const delivery = requests.at(-1); assert.equal(JSON.parse(delivery.body).eventId, eventId);
    const expected = crypto.createHmac('sha256', Buffer.from(secret.slice(6), 'base64')).update(`${eventId}.${delivery.headers['webhook-timestamp']}.${delivery.body}`).digest('base64'); assert.equal(delivery.headers['webhook-signature'], `v1,${expected}`);
    const refresh = { grant_type: 'refresh_token', client_id: first.clientId, refresh_token: first.refresh_token, resource: endpoint };
    assert.equal((await request('/api/v1/mcp/oauth/token', 'POST', refresh)).res.status, 200);
    assert.equal((await request('/api/v1/mcp/oauth/token', 'POST', refresh)).data.error, 'invalid_grant');
    mcp.revoke(user.id); assert.equal(mcp.status(user).subscriptions, 0);
    assert.equal((await request('/api/v1/mcp', 'POST', { jsonrpc: '2.0', id: 2, method: 'tools/list' }, first.access_token)).res.status, 401);
    assert.equal((await rpc(second.access_token, 'tools/list')).result.tools.length, 4);
    assert.equal(JSON.stringify(w).includes('whsec_'), false);
    const otherSubscription = await rpc(second.access_token, 'events/subscribe', { name: 'jobs.discovered', arguments: {}, delivery: { mode: 'webhook', url: 'https://receiver.example/callback', secret } });
    assert.ok(otherSubscription.result.id);
    mcp.enqueue(other, ['other-posting']); assert.equal(db.mcp.outbox.length, 1);
    mcp = createMcpService({ ...options, allowedEmails: [user.email] });
    assert.equal(mcp.status(other).allowed, false);
    assert.equal(mcp.status(other).connected, false);
    assert.throws(() => mcp.consent(other, 'old-request', { approve: true }), /ACCOUNT_NOT_ALLOWED/);
    assert.equal((await request('/api/v1/mcp', 'POST', { jsonrpc: '2.0', id: 3, method: 'tools/list' }, second.access_token)).res.status, 401);
    assert.equal((await request('/api/v1/mcp/oauth/token', 'POST', { ...refresh, client_id: second.clientId, refresh_token: second.refresh_token })).data.error, 'invalid_grant');
    const requestCount = requests.length;
    mcp.enqueue(other, ['another-posting']); assert.equal(db.mcp.outbox.length, 1);
    await mcp.flush(); assert.equal(db.mcp.outbox.length, 0); assert.equal(requests.length, requestCount);
    mcp.prune(); assert.equal(Object.values(db.mcp.tokens).some(token => token.userId === other.id), false);
    assert.equal(Object.values(db.mcp.subscriptions).some(sub => sub.userId === other.id), false);
    mcp = createMcpService({ ...options, allowedEmails: [] });
    assert.equal(mcp.status(user).configured, false);
    assert.equal((await request('/.well-known/oauth-authorization-server')).res.status, 503);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
