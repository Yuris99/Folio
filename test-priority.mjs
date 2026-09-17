import { calculateDeadlineScore, clampScore, getPriorityBreakdown, getPriorityLabel } from './src/priority.ts';
import { scheduleWorkspace, matchesApplicationTab, applicationStatuses, normalizedApplicationStatus, statusClass, daysUntil } from './src/utils.ts';

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
const user = {workspace:{...scheduleFixture,interviews:[scheduleFixture.interviews[0]]},googleCalendar:{eventIds:{"job:j":"deadline-event","process:a:step":"process-event","interview:hidden":"interview-event"}}};
const synced = await context.syncGoogleCalendar(user);
assert(synced.removed === 3 && synced.total === 0, "previously synced rejected events removed");
assert(requests.length === 3 && requests.every(item=>item.method === "DELETE"), "no rejected events recreated");
console.log("PASS rejection filtering and Google Calendar cleanup");
