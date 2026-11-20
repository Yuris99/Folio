const { test } = require('node:test');
const assert = require('node:assert/strict');
const d = require('./lib/job-discovery');

const body = '담당 업무: Java와 Spring으로 API를 개발합니다. 자격 요건: Java 프로젝트 경험과 SQL 이해가 필요합니다. 우대 사항: Docker 운영 경험과 팀 협업을 우대합니다.';
function workspace() {
  return { profile: { role: 'Java', desiredLocation: '서울' }, jobs: [], applications: [], archivedApplications: [],
    careerFacts: [{ id: 'fact-1', category: 'project', title: 'API 프로젝트', description: 'Java API 개발', skills: ['Java', 'Spring'], status: 'verified', sensitive: false },
      { id: 'review', category: 'experience', title: '미확인 경력', status: 'review', sensitive: false, skills: ['Python'] },
      { id: 'private', category: 'profile', title: '전화번호', status: 'verified', sensitive: true, skills: [] }] };
}
const raw = (extra = {}) => d.newPosting({ company: '테스트 기업', title: 'Java 개발자', url: 'https://jobs.example.com/1', description: body, location: '서울', deadline: '2099-12-31', ...extra });

test('a posting carries its recommendation reason and five priority levels', () => {
  const item = raw({ recommendation: { reason: 'API 경험과 맞음', expectedGrade: 'A', careerLevel: 5, compensationLevel: 3, passLevel: 4, workLevel: 2, score: 82 } });
  assert.deepEqual(item.recommendation, { reason: 'API 경험과 맞음', expectedGrade: 'A', careerLevel: 5, compensationLevel: 3, passLevel: 4, workLevel: 2, score: 82 });
  assert.equal(raw({ recommendation: { careerGrade: 'B' } }).recommendation.expectedGrade, 'B', 'the old field name is read as the expected grade');
  assert.equal(item.deadline, '2099-12-31');
  assert.deepEqual(raw({ recommendation: { careerLevel: 0, expectedGrade: '' } }).recommendation, { reason: '' }, 'empty levels stay unset');
  assert.throws(() => raw({ recommendation: { careerLevel: 6 } }), /INVALID_POSTING/);
  assert.throws(() => raw({ recommendation: { expectedGrade: 'Z' } }), /INVALID_POSTING/);
  assert.throws(() => raw({ recommendation: { score: 120 } }), /INVALID_POSTING/);
  assert.throws(() => raw({ deadline: '다음 주' }), /INVALID_POSTING/);
  assert.throws(() => raw({ url: 'javascript:alert(1)' }), /INVALID_POSTING/);
  assert.throws(() => raw({ title: '' }), /INVALID_POSTING/);
});
test('dedupe keeps hidden state, recorded reason and different cycles', () => {
  const items = [];
  const first = d.mergePosting(items, raw({ recommendation: { reason: '처음 사유', careerLevel: 4 } })).item; first.hidden = true;
  const again = d.mergePosting(items, raw({ description: '짧음' }));
  assert.equal(again.added, false); assert.equal(first.hidden, true);
  assert.equal(first.description, body, 'a shorter body never replaces a full one');
  assert.equal(first.recommendation.reason, '처음 사유', 'a re-send without a reason keeps the recorded one');
  d.mergePosting(items, raw({ recommendation: { reason: '새 사유' } }));
  assert.equal(first.recommendation.reason, '새 사유', 'a new reason replaces the old one');
  assert.equal(d.mergePosting(items, raw({ deadline: '2099-06-30', url: 'https://jobs.example.com/2' })).added, true, 'another cycle is a new posting');
  const bot = d.newPosting({ company: '테스트 기업', title: 'Java 개발자', url: 'https://jobs.example.com/1?utm_source=bot', deadline: '2099-12-31', externalId: 'bot-1' }, 'bot');
  assert.equal(d.mergePosting(items, bot).added, false, 'the same vacancy from a bot merges');
  assert.equal(first.sources.length, 2);
});
test('registering saves the job once with its reason and levels; rejection hides it', () => {
  const w = workspace(), state = d.ensureDiscovery(w);
  const a = d.mergePosting(state.items, raw({ recommendation: { reason: '맞음', careerLevel: 5, passLevel: 3 } })).item;
  const b = d.mergePosting(state.items, raw({ title: '영업 담당자', url: 'https://jobs.example.com/sales' })).item;
  assert.throws(() => d.decidePosting(w, b, { decision: 'maybe' }), /INVALID_DECISION/);
  assert.equal(d.decidePosting(w, b, { decision: 'rejected', reasons: ['직무가 안 맞음', '직무가 안 맞음', ''], note: ' 영업 비중이 높음 ' }), null);
  assert.equal(b.hidden, true); assert.deepEqual(b.decision.reasons, ['직무가 안 맞음']); assert.equal(b.decision.note, '영업 비중이 높음');
  const job = d.decidePosting(w, a, { decision: 'registered', reasons: ['직무가 잘 맞음'] });
  assert.equal(job.discoveryPostingId, a.id); assert.equal(a.savedJobId, job.id);
  assert.deepEqual(job.recommendation, { reason: '맞음', careerLevel: 5, passLevel: 3 });
  assert.equal(d.savePosting(w, a).id, job.id); assert.equal(w.jobs.length, 1); assert.equal(w.applications.length, 0, 'registering never creates an application');
});
test('rejected or archived applications suppress the recommendation', () => {
  const w = workspace(), item = d.mergePosting(d.ensureDiscovery(w).items, raw()).item;
  const job = d.savePosting(w, item);
  w.applications.push({ id: 'a', jobId: job.id, status: '불합격' }); assert.equal(d.postingView(w, item).suppressed, true);
  w.applications = []; w.archivedApplications.push({ id: 'a', jobId: job.id, status: '관심' }); assert.equal(d.postingView(w, item).suppressed, true);
  assert.deepEqual(d.postingView({ ...workspace(), archivedApplications: [] }, item).matchedKeywords, ['Java', 'Spring']);
});
