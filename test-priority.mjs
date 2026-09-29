import { calculateDeadlineScore, clampScore, getPriorityBreakdown, getPriorityLabel } from './src/priority.ts';
import { scheduleWorkspace, matchesApplicationTab, applicationStatuses, normalizedApplicationStatus, statusClass, daysUntil, processStageGroup } from './src/utils.ts';

function assert(condition, message) {
  if (!condition) throw new Error(`Priority test failed: ${message}`);
}

assert(applicationStatuses.includes('불합격'), 'rejected status is selectable');
assert(normalizedApplicationStatus('불합격') === '불합격', 'rejected status is preserved');
assert(normalizedApplicationStatus('탈락') === '불합격', 'legacy rejected status is preserved');
assert(statusClass('불합격') === 'closed', 'rejected status uses closed styling');
assert(calculateDeadlineScore('2026-09-02', new Date('2026-09-02T09:00:00')) === 50, 'D-day score');
assert(calculateDeadlineScore('2026-09-03', new Date('2026-09-02T09:00:00')) === 40, 'D-1 score');
assert(calculateDeadlineScore('2026-09-05', new Date('2026-09-02T09:00:00')) === 15, 'D-3 score');
assert(calculateDeadlineScore('2026-09-10', new Date('2026-09-02T09:00:00')) === 3, 'D-8 score');
assert(daysUntil('2026-09-03T07:00', new Date('2026-09-02T09:00:00')) === 0, '22 hours remaining is D-DAY');
assert(daysUntil('2026-09-03T23:00', new Date('2026-09-02T09:00:00')) === 1, '38 hours remaining is D-1');
assert(daysUntil('2026-09-04T08:59', new Date('2026-09-02T09:00:00')) === 1, 'under 48 hours remaining is D-1');
assert(daysUntil('2026-09-03T09:00', new Date('2026-09-02T09:00:00')) === 1, 'exactly 24 hours remaining is D-1');
assert(daysUntil('2026-09-04T09:00', new Date('2026-09-02T09:00:00')) === 2, 'exactly 48 hours remaining is D-2');
assert(daysUntil('2026-09-02', new Date('2026-09-02T09:00:00')) === 0, 'date-only deadline today is D-DAY');
assert(daysUntil('2026-09-02T09:00', new Date('2026-09-02T09:00:01')) === -1, 'just expired deadline is negative');
assert(daysUntil('2026-09-02T08:00', new Date('2026-09-02T09:00:00')) === -1, 'expired deadline is negative');
assert(calculateDeadlineScore('2026-09-01', new Date('2026-09-02T09:00:00')) === 0, 'expired deadline score');
const alwaysOpen = getPriorityBreakdown({ id:'a', jobId:'j', status:'관심', next:'', careerGrade:'S' }, { id:'j', company:'회사', role:'Backend', deadline:'2026-09-03', alwaysOpen:true, url:'', description:'', skills:[] });
assert(alwaysOpen.deadline === 0, 'always-open deadline score');
const activeProcess = getPriorityBreakdown({ id:'a', jobId:'j', status:'전형 진행', next:'', careerGrade:'S' }, { id:'j', company:'회사', role:'Backend', deadline:'2099-09-02', url:'', description:'', skills:[] });
assert(activeProcess.deadline === 0, 'active process excludes deadline score');
assert(clampScore(120, 0, 100) === 100, 'upper clamp');
assert(getPriorityLabel(85) === '최우선' && getPriorityLabel(84) === '적극 지원', 'priority threshold');
const result = getPriorityBreakdown({ id:'a', jobId:'j', status:'관심', next:'', careerGrade:'B', applicationFitScore:18, compensationScore:15, companyScore:5, locationScore:10, processScore:8, priorityAdjustment:10 }, { id:'j', company:'회사', role:'Backend', deadline:'', url:'', description:'', skills:[] });
assert(result.final === 77, 'B-preference high-fit calculation');
assert(!('adjustment' in result), 'manual adjustment excluded');
console.log('PASS priority calculation');

assert(!matchesApplicationTab("불합격", "전체"), "rejected applications excluded from all tab");
assert(!matchesApplicationTab("탈락", "결과 대기"), "legacy rejection excluded from waiting tab");
assert(matchesApplicationTab("탈락", "불합격"), "legacy rejection shown in rejection tab");
assert(matchesApplicationTab("전형 진행", "전체"), "active application remains visible");
const scheduleFixture = { applications: [{id:"a",jobId:"j",status:"불합격",processSteps:[{id:"step",date:"2099-01-01",status:"예정"}]}], archivedApplications: [], jobs:[{id:"j",company:"회사",role:"개발자",deadline:"2099-01-01"},{id:"other",company:"회사",role:"디자이너"}], interviews:[{id:"hidden",company:" 회사 ",role:"개발자",date:"2099-01-01"},{id:"visible",company:"회사",role:"디자이너",date:"2099-01-01"}], tasks:[] };
const filteredSchedule = scheduleWorkspace(scheduleFixture);
assert(filteredSchedule.applications.length === 0, "rejected process dates and todos hidden");
assert(filteredSchedule.jobs.length === 1, "rejected deadline hidden");
assert(filteredSchedule.interviews.length === 1 && filteredSchedule.interviews[0].id === "visible", "only related interviews hidden");
assert(scheduleFixture.applications[0].processSteps.length === 1, "schedule records preserved");
const reopened = scheduleWorkspace({...scheduleFixture,applications:[{...scheduleFixture.applications[0],status:"전형 진행"}]});
assert(reopened.applications.length === 1 && reopened.interviews.length === 2, "reopening restores schedule visibility");
const archivedSchedule = scheduleWorkspace({...scheduleFixture,applications:[],archivedApplications:scheduleFixture.applications});
assert(archivedSchedule.interviews.length === 1, "archiving rejection does not revive interview");

// Execute the production Google Calendar builder and sync against an isolated mock.
const { readFileSync } = await import("node:fs");
const { runInNewContext } = await import("node:vm");
const serverSource = readFileSync(new URL("./server.js", import.meta.url), "utf8");
const calendarCode = serverSource.slice(serverSource.indexOf("function calendarTime("), serverSource.indexOf("function extractResponseText("));
const requests = [];
const context = { calendarAccessToken:async()=>"test-token", now:()=>"2099-01-01", saveDb:()=>{}, fetch:async(url, options)=>{requests.push({url,method:options.method}); return {ok:true,status:204};} };
runInNewContext(calendarCode, context);
const built = context.folioCalendarEvents(scheduleFixture);
assert(built.events.length === 1 && built.events[0].key === "interview:visible", "Google calendar excludes rejected deadline, process and interview");
const deadlineFixture = { applications: [{id:"b",jobId:"k",status:"지원 준비",processSteps:[{id:"doc",name:"서류 마감",date:"2099-02-01T18:00",status:"예정"},{id:"moved",name:"서류 마감",date:"2099-02-05",status:"예정"},{id:"int",name:"1차 면접",date:"2099-02-10T14:00",status:"예정"}]}], archivedApplications: [], jobs:[{id:"k",company:"회사",role:"개발자",deadline:"2099-02-01T18:00"}], interviews:[], tasks:[] };
const deadlineKeys = context.folioCalendarEvents(deadlineFixture).events.map((item) => item.key).sort();
assert(JSON.stringify(deadlineKeys) === JSON.stringify(["job:k","process:b:int","process:b:moved"]), "document deadline step is not duplicated when it matches the job deadline");
const user = {workspace:{...scheduleFixture,interviews:[scheduleFixture.interviews[0]]},googleCalendar:{eventIds:{"job:j":"deadline-event","process:a:step":"process-event","interview:hidden":"interview-event"}}};
const synced = await context.syncGoogleCalendar(user);
assert(synced.removed === 3 && synced.total === 0, "previously synced rejected events removed");
assert(requests.length === 3 && requests.every(item=>item.method === "DELETE"), "no rejected events recreated");
console.log("PASS rejection filtering and Google Calendar cleanup");

const { applicationStats, documentOutcome } = await import('./src/utils.ts');
const statsFixture = [
  { id: 's1', jobId: 'j1', status: '관심', next: '', documentResult: '합격' },
  { id: 's2', jobId: 'j2', status: '전형 진행', next: '', documentResult: '합격' },
  { id: 's3', jobId: 'j3', status: '불합격', next: '', documentResult: '불합격' },
  { id: 's4', jobId: 'j4', status: '결과 대기', next: '' },
  { id: 's5', jobId: 'j5', status: '결과 대기', next: '', documentResult: '합격' },
  { id: 's6', jobId: 'j6', status: '불합격', next: '', documentResult: '합격' },
  { id: 's7', jobId: 'j7', status: '불합격', next: '' }
];
assert(documentOutcome(statsFixture[0]) === 'not-submitted', 'interested application is not submitted');
assert(documentOutcome(statsFixture[1]) === 'passed', 'manual document pass');
assert(documentOutcome(statsFixture[2]) === 'failed', 'manual document fail');
assert(documentOutcome(statsFixture[3]) === 'pending', 'no result recorded yet is pending');
assert(documentOutcome(statsFixture[5]) === 'passed', 'rejection after interview still passed documents');
assert(documentOutcome(statsFixture[6]) === 'unrecorded', 'rejection without document result is excluded');
const summary = applicationStats(statsFixture);
assert(summary.submitted === 6 && summary.passed === 3 && summary.failed === 1 && summary.pending === 1, 'document stats counts');
assert(summary.passRate === 75, 'document pass rate excludes pending and unrecorded');
assert(summary.milestone === 0 && summary.nextMilestone === 10 && summary.milestoneProgress === 60, 'milestone progress');
assert(applicationStats(Array.from({ length: 23 }, (_, index) => ({ id: `m${index}`, jobId: 'j', status: '결과 대기', next: '' }))).milestone === 20, '10-application milestones');
console.log('PASS document pass rate and milestones');

const { stageResultStats, weeklySubmissions, canonicalStageName, statsApplications } = await import('./src/utils.ts');
const stageFixture = [
  { id: 'a', jobId: 'j', status: '전형 진행', next: '', processSteps: [{ id: '1', name: '1차 면접', date: '', status: '완료', result: '합격' }, { id: '2', name: '코딩 테스트', date: '', status: '완료', result: '불합격' }] },
  { id: 'b', jobId: 'j', status: '불합격', next: '', processSteps: [{ id: '3', name: '1차 면접', date: '', status: '완료', result: '불합격' }, { id: '4', name: '커피챗', date: '', status: '완료', result: '합격' }] }
];
const stageRows = stageResultStats(stageFixture);
assert(stageRows.map((row) => row.name).join(',') === '코딩 테스트,1차 면접,커피챗', 'stages follow process order, custom stages last');
assert(stageRows[1].passed === 1 && stageRows[1].failed === 1, 'stage pass/fail counts');
const weekly = weeklySubmissions([
  { id: 'w1', jobId: 'j', status: '결과 대기', next: '', appliedAt: '2026-09-28T10:00' },
  { id: 'w2', jobId: 'j', status: '전형 진행', next: '', appliedAt: '2026-09-21' },
  { id: 'w3', jobId: 'j', status: '지원 준비', next: '', appliedAt: '2026-09-28' },
  { id: 'w4', jobId: 'j', status: '결과 대기', next: '', appliedAt: '2026-01-01' }
], 4, new Date('2026-09-30T12:00:00'));
assert(weekly.length === 4 && weekly[3].count === 1 && weekly[2].count === 1 && weekly[0].count === 0, 'weekly submissions bucket by Monday week, skip unsubmitted and old');
console.log('PASS stage and weekly statistics');

const stageOf = (steps) => processStageGroup({ id: 's', jobId: 'j', status: '전형 진행', next: '', processSteps: steps.map(([name, status], index) => ({ id: String(index), name, date: '', status })) });
assert(stageOf([['서류 마감', '완료'], ['서류 결과', '예정']]) === '서류 심사', 'document review stage');
assert(stageOf([['서류 결과', '완료'], ['코테', '예정']]) === '테스트', 'coding test grouped as test');
assert(stageOf([['서류 결과', '완료'], ['AI 역량검사', '예정']]) === '테스트', 'AI competency test grouped as test');
assert(stageOf([['인적성 검사', '완료'], ['최종 면접', '진행 중'], ['처우 협의', '예정']]) === '면접', 'in-progress step wins and final interview is an interview');
assert(stageOf([['1차 면접', '완료'], ['처우 협의', '예정']]) === '최종 조율', 'offer stage');
assert(stageOf([['최종 면접', '완료'], ['채용검진', '예정']]) === '최종 조율', 'medical check grouped as final stage');
assert(stageOf([]) === '단계 미등록', 'no steps');
console.log('PASS process stage groups');

const canonical = (name) => canonicalStageName(name);
assert(canonical('1차면접') === '1차 면접' && canonical('1차 실무 면접') === '1차 면접' && canonical('실무면접') === '1차 면접', 'first interview variants merge');
assert(canonical('2차 임원면접') === '2차 면접' && canonical('임원 면접') === '임원 면접' && canonical('최종면접') === '최종 면접', 'numbered interviews win over executive label');
assert(canonical('인적성 검사') === '인적성' && canonical('SKCT') === '인적성' && canonical('GSAT') === '인적성', 'aptitude test variants merge');
assert(canonical('AI 역량검사') === 'AI 역량검사' && canonical('AI면접') === 'AI 역량검사' && canonical('역검') === 'AI 역량검사', 'AI competency variants merge');
assert(canonical('필기 시험') === '필기' && canonical('코테') === '코딩 테스트' && canonical('서류 마감') === '서류' && canonical('채용검진') === '채용검진', 'other well-known stages');
assert(canonical('커피 챗') === '커피 챗', 'unknown stage keeps its name');
const mergedRows = stageResultStats([
  { id: 'x', jobId: 'j', status: '불합격', next: '', processSteps: [{ id: '1', name: '서류 마감', date: '', status: '완료', result: '합격' }, { id: '2', name: '1차면접', date: '', status: '완료', result: '불합격' }] },
  { id: 'y', jobId: 'j', status: '전형 진행', next: '', processSteps: [{ id: '3', name: '서류 결과', date: '', status: '완료', result: '합격' }, { id: '4', name: '1차 면접', date: '', status: '완료', result: '합격' }] }
]);
assert(mergedRows.map((row) => `${row.name}:${row.passed}/${row.failed}`).join(',') === '서류:2/0,1차 면접:1/1', 'stage statistics merge similar names');
assert(statsApplications({ applications: [{ id: 'active' }], archivedApplications: [{ id: 'archived' }] }).map((item) => item.id).join() === 'active', 'applications moved to the job vault are excluded from statistics');
console.log('PASS well-known stage names and archived exclusion');
