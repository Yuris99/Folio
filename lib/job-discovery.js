// Recommended postings: added by hand or by the user's own bot, then registered or rejected.
// Folio no longer collects postings or analyses them itself.
const crypto = require('crypto');
const iso = () => new Date().toISOString();
const clean = (value, max = 2000) => String(value ?? '').trim().slice(0, max);
const list = value => Array.isArray(value) ? [...new Set(value.map(item => clean(item, 100)).filter(Boolean))].slice(0, 20) : [];
const key = value => clean(value, 50000).toLocaleLowerCase().replace(/[\s​-‍]+/g, '');
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sameVacancy = (a, b) => key(a.company) === key(b.company) && key(a.title || a.role) === key(b.title || b.role) && !(a.deadline && b.deadline && a.deadline !== b.deadline);

const LEVEL_KEYS = ['careerLevel', 'compensationLevel', 'passLevel', 'workLevel'];
const GRADES = ['S', 'A', 'B', 'C', 'D'];
const DECISIONS = ['registered', 'rejected'];

function safeLink(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
function canonicalUrl(value) {
  const link = safeLink(value); if (!link) return '';
  const url = new URL(link); url.hash = '';
  for (const name of [...url.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/i.test(name)) url.searchParams.delete(name);
  url.searchParams.sort(); return url.href.replace(/\/$/, '');
}
function cleanDeadline(value) {
  const text = clean(value, 40);
  if (!text) return '';
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/.test(text) || Number.isNaN(Date.parse(text.includes('T') ? text : `${text}T00:00:00`))) throw new Error('INVALID_POSTING');
  return text;
}

function ensureDiscovery(workspace) {
  workspace.discovery ||= { items: [] };
  workspace.discovery.items = Array.isArray(workspace.discovery.items) ? workspace.discovery.items : [];
  return workspace.discovery;
}

// Why the posting was recommended plus the same five priority levels the applications use.
function normalizeRecommendation(raw) {
  const value = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = { reason: clean(value.reason, 2000) };
  if (value.careerGrade !== undefined && value.careerGrade !== '' && value.careerGrade !== null) {
    if (!GRADES.includes(value.careerGrade)) throw new Error('INVALID_POSTING');
    out.careerGrade = value.careerGrade;
  }
  for (const name of LEVEL_KEYS) {
    if (value[name] === undefined || value[name] === null || value[name] === '' || value[name] === 0) continue;
    const level = Number(value[name]);
    if (!Number.isInteger(level) || level < 1 || level > 5) throw new Error('INVALID_POSTING');
    out[name] = level;
  }
  if (value.score !== undefined && value.score !== null && value.score !== '') {
    const score = Number(value.score);
    if (!Number.isInteger(score) || score < 0 || score > 100) throw new Error('INVALID_POSTING');
    out.score = score;
  }
  const by = clean(value.by, 60);
  if (by) out.by = by;
  return out;
}
const hasRecommendation = value => Boolean(value && (value.reason || value.careerGrade || value.score !== undefined || LEVEL_KEYS.some(name => value[name])));

function newPosting(payload, source = 'manual') {
  const url = safeLink(payload?.url), title = clean(payload?.title, 300), description = clean(payload?.description, 40000);
  if (!url || !title) throw new Error('INVALID_POSTING');
  const company = clean(payload.company, 200);
  const externalId = clean(payload.externalId, 200) || digest([canonicalUrl(url), key(company), key(title)]);
  return { company, title, description, url, location: clean(payload.location, 200), experience: clean(payload.experience, 200),
    deadline: cleanDeadline(payload.deadline), alwaysOpen: payload.alwaysOpen === true,
    contentQuality: description.length >= 100 ? 'full' : 'partial', publishedAt: '',
    sources: [{ source, externalId, url }], closed: payload.closed === true,
    recommendation: normalizeRecommendation(payload.recommendation) };
}

function mergePosting(items, raw) {
  const identity = source => `${source.source}:${source.externalId}`;
  const url = canonicalUrl(raw.url);
  let item = items.find(existing => existing.sources.some(a => raw.sources.some(b => identity(a) === identity(b))) || (url && canonicalUrl(existing.url) === url && sameVacancy(existing, raw)));
  // Only coalesce matching company, full title AND a known matching deadline.
  item ||= raw.company && raw.deadline ? items.find(existing => key(existing.company) === key(raw.company) && key(existing.title) === key(raw.title) && existing.deadline === raw.deadline) : null;
  if (item) {
    const sources = [...item.sources];
    for (const source of raw.sources) if (!sources.some(old => identity(old) === identity(source))) sources.push(source);
    const keep = {};
    if (item.contentQuality === 'full' && raw.contentQuality !== 'full') Object.assign(keep, { description: item.description, contentQuality: item.contentQuality });
    // A re-sent posting without a reason or levels never erases the ones already recorded.
    if (!hasRecommendation(raw.recommendation) && item.recommendation) keep.recommendation = item.recommendation;
    for (const name of ['deadline', 'location', 'experience', 'company']) if (!raw[name] && item[name]) keep[name] = item[name];
    Object.assign(item, raw, keep, { sources, checkedAt: iso() });
    return { item, added: false };
  }
  item = { ...raw, id: crypto.randomUUID(), discoveredAt: iso(), checkedAt: iso(), hidden: false };
  items.unshift(item); return { item, added: true };
}

function verifiedCareer(workspace) {
  const facts = (workspace.careerFacts || []).filter(item => item.status === 'verified' && !item.sensitive && item.category !== 'profile')
    .map(({ id, category, title, organization, period, description, achievements, skills }) => ({ id, category, title, organization, period, description, achievements, skills: list(skills) }));
  return { targetRole: clean(workspace.profile?.role, 300), desiredLocation: clean(workspace.profile?.desiredLocation, 300),
    facts, skills: [...new Set(facts.flatMap(item => item.skills))] };
}

function linkedJob(workspace, item) {
  return (workspace.jobs || []).find(job => job.id === item.savedJobId || (canonicalUrl(job.url) && canonicalUrl(job.url) === canonicalUrl(item.url) && sameVacancy(job, item)) ||
    (item.company && sameVacancy(job, item)));
}
function postingView(workspace, item) {
  const job = linkedJob(workspace, item);
  const applications = [...(workspace.applications || []), ...(workspace.archivedApplications || [])].filter(a => a.jobId === job?.id);
  const archived = job && !(workspace.applications || []).some(a => a.jobId === job.id) && (workspace.archivedApplications || []).some(a => a.jobId === job.id);
  const rejected = applications.some(a => ['불합격', '탈락'].includes(a.status));
  const skills = verifiedCareer(workspace).skills;
  return { ...item, savedJobId: job?.id || item.savedJobId || '', suppressed: Boolean(rejected || archived),
    matchedKeywords: skills.filter(skill => key(`${item.title} ${item.description}`).includes(key(skill))) };
}
function savePosting(workspace, item) {
  let job = linkedJob(workspace, item);
  const recommendation = hasRecommendation(item.recommendation) ? { ...item.recommendation } : undefined;
  if (!job) {
    job = { id: crypto.randomUUID(), company: item.company || '기업명 확인 필요', role: item.title, location: item.location || '',
      deadline: item.deadline || '', alwaysOpen: Boolean(item.alwaysOpen), url: item.url, description: item.description,
      skills: [], discoveryPostingId: item.id, createdAt: iso() };
    workspace.jobs.unshift(job);
  }
  // The reason and levels travel with the job, so a later application starts from them.
  if (recommendation && !hasRecommendation(job.recommendation)) job.recommendation = recommendation;
  item.savedJobId = job.id; return job;
}

function decidePosting(workspace, item, payload) {
  const kind = payload?.decision;
  if (!DECISIONS.includes(kind)) throw new Error('INVALID_DECISION');
  if (payload.reasons !== undefined && !Array.isArray(payload.reasons)) throw new Error('INVALID_DECISION');
  const reasons = [...new Set(list(payload.reasons).map(value => clean(value, 60)).filter(Boolean))].slice(0, 10);
  item.decision = { kind, reasons, note: clean(payload.note, 1000), decidedAt: iso() };
  if (kind === 'registered') { item.hidden = false; return savePosting(workspace, item); }
  item.hidden = true; return null;
}

// Past register/reject choices, so the user's bot can learn what the user actually wants.
function recommendationFeedback(workspace, exceptId = '', limit = 40) {
  const decided = ensureDiscovery(workspace).items.filter(item => item.decision && DECISIONS.includes(item.decision.kind) && item.id !== exceptId)
    .sort((a, b) => String(b.decision.decidedAt).localeCompare(String(a.decision.decidedAt)));
  const count = kind => Object.entries(decided.filter(item => item.decision.kind === kind).flatMap(item => item.decision.reasons || [])
    .reduce((acc, reason) => ({ ...acc, [reason]: (acc[reason] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]).map(([reason, times]) => ({ reason, times }));
  return { registeredCount: decided.filter(item => item.decision.kind === 'registered').length, rejectedCount: decided.filter(item => item.decision.kind === 'rejected').length,
    topRegisteredReasons: count('registered'), topRejectedReasons: count('rejected'),
    recent: decided.slice(0, limit).map(item => ({ decision: item.decision.kind, reasons: item.decision.reasons || [], note: item.decision.note || '', decidedAt: item.decision.decidedAt,
      company: item.company, title: item.title, location: item.location, experience: item.experience, url: item.url,
      recommendation: hasRecommendation(item.recommendation) ? item.recommendation : undefined,
      summary: clean(item.recommendation?.reason || item.analysis?.summary || item.description, 300) })) };
}

// Everything a bot needs to recommend the next posting, without contact details or files.
function botContext(workspace, limit = 40) {
  const items = ensureDiscovery(workspace).items;
  return { format: 'folio-recommendation-context', version: 1, career: verifiedCareer(workspace), feedback: recommendationFeedback(workspace, '', limit),
    knownPostings: items.slice(0, 500).map(item => ({ url: item.url, company: item.company, title: item.title, deadline: item.deadline,
      status: item.decision?.kind || (item.hidden ? 'rejected' : 'pending') })) };
}

module.exports = { ensureDiscovery, mergePosting, newPosting, normalizeRecommendation, verifiedCareer, postingView, savePosting, decidePosting,
  recommendationFeedback, botContext, canonicalUrl, safeLink };
