import { calculateDeadlineScore, clampScore, getPriorityBreakdown, getPriorityLabel } from './src/priority.ts';

function assert(condition, message) {
  if (!condition) throw new Error(`Priority test failed: ${message}`);
}

assert(calculateDeadlineScore('2026-09-02', new Date('2026-09-02T09:00:00')) === 5, 'D-day score');
assert(calculateDeadlineScore('2026-09-10', new Date('2026-09-02T09:00:00')) === 2, 'D-8 score');
assert(calculateDeadlineScore('2026-09-01', new Date('2026-09-02T09:00:00')) === 0, 'expired deadline score');
assert(clampScore(120, 0, 100) === 100, 'upper clamp');
assert(getPriorityLabel(85) === '최우선' && getPriorityLabel(84) === '적극 지원', 'priority threshold');
const result = getPriorityBreakdown({ id:'a', jobId:'j', status:'관심', next:'', careerGrade:'B', applicationFitScore:18, companyScore:15, locationScore:10, processScore:8, priorityAdjustment:0 }, { id:'j', company:'회사', role:'Backend', deadline:'', url:'', description:'', skills:[] });
assert(result.final === 78, 'B-grade high-fit calculation');
console.log('PASS priority calculation');
