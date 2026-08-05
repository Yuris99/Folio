const { spawn } = require('child_process');
const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const port = 4187;
const base = `http://localhost:${port}`;
const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(),'folio-test-'));
const server = spawn(process.execPath, ['server.js'], { cwd:__dirname, env:{...process.env,PORT:String(port),NODE_ENV:'development',FOLIO_DATA_DIR:testDataDir,GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:'',OPENAI_API_KEY:''}, stdio:['ignore','pipe','pipe'] });

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function ready() {
  for(let i=0;i<30;i++) { try { const r=await fetch(`${base}/api/v1/health`); if(r.ok)return; } catch {} await wait(100); }
  throw new Error('server did not start');
}
async function json(path, options={}, cookie='') {
  const response=await fetch(`${base}${path}`,{...options,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...(options.headers||{})}});
  const data=response.status===204?null:await response.json();
  return {response,data};
}

(async()=>{
  try {
    await ready();
    const health=await json('/api/v1/health');
    assert.equal(health.response.status,200);
    assert.equal(health.data.data.status,'ok');

    const unauthenticated=await json('/api/v1/bootstrap');
    assert.equal(unauthenticated.response.status,401);
    const privateFile=await fetch(`${base}/.data/db.json`);
    assert.equal(privateFile.status,404);

    const login=await fetch(`${base}/api/v1/auth/google?returnTo=${encodeURIComponent(base+'/')}`,{redirect:'manual'});
    assert.equal(login.status,302);
    const cookie=login.headers.get('set-cookie').split(';')[0];
    assert.ok(cookie.startsWith('folio_session='));

    const session=await json('/api/v1/auth/session',{},cookie);
    assert.equal(session.response.status,200);
    assert.equal(session.data.data.email,'demo@folio.local');

    const bootstrap=await json('/api/v1/bootstrap',{},cookie);
    assert.equal(bootstrap.response.status,200);
    assert.ok(Array.isArray(bootstrap.data.data.applications));

    const profile=await json('/api/v1/profile',{method:'PUT',body:JSON.stringify({name:'테스트 사용자',role:'Frontend Developer'})},cookie);
    assert.equal(profile.data.data.name,'테스트 사용자');

    const created=await json('/api/v1/applications',{method:'POST',body:JSON.stringify({company:'테스트 회사',role:'개발자',status:'작성 중',deadline:'2026-09-01',next:'지원서 작성'})},cookie);
    assert.equal(created.response.status,201);
    const applicationId=created.data.data.id;

    const updated=await json(`/api/v1/applications/${applicationId}`,{method:'PATCH',body:JSON.stringify({status:'지원 완료'})},cookie);
    assert.equal(updated.data.data.status,'지원 완료');

    const task=await json('/api/v1/tasks',{method:'POST',body:JSON.stringify({text:'테스트 할 일',date:'오늘',done:false})},cookie);
    const taskUpdated=await json(`/api/v1/tasks/${task.data.data.id}`,{method:'PATCH',body:JSON.stringify({done:true})},cookie);
    assert.equal(taskUpdated.data.data.done,true);

    const interview=await json('/api/v1/interviews',{method:'POST',body:JSON.stringify({company:'테스트 회사',role:'개발자',date:'2026-09-03',type:'기술 면접',memo:'온라인'})},cookie);
    assert.equal(interview.response.status,201);
    const interviewUpdated=await json(`/api/v1/interviews/${interview.data.data.id}`,{method:'PATCH',body:JSON.stringify({memo:'본사 방문'})},cookie);
    assert.equal(interviewUpdated.data.data.memo,'본사 방문');

    const job=await json('/api/v1/jobs',{method:'POST',body:JSON.stringify({company:'AI 회사',role:'Frontend',description:'React와 TypeScript 협업 경험',deadline:'2026-09-02',skills:[]})},cookie);
    const analysis=await json('/api/v1/ai/jobs/analyze',{method:'POST',body:JSON.stringify({description:'React와 TypeScript 협업 경험'})},cookie);
    assert.deepEqual(analysis.data.data.skills,['React','TypeScript','협업']);

    const document=await json('/api/v1/ai/documents/generate',{method:'POST',body:JSON.stringify({jobId:job.data.data.id,careerStoryIds:[]})},cookie);
    assert.equal(document.response.status,201);
    assert.ok(document.data.data.content.length>20);

    const invalidFile=await json('/api/v1/files',{method:'POST',body:JSON.stringify({name:'fake.pdf',type:'application/pdf',data:`data:application/pdf;base64,${Buffer.from('not-a-pdf').toString('base64')}`})},cookie);
    assert.equal(invalidFile.response.status,415);

    const file=await json('/api/v1/files',{method:'POST',body:JSON.stringify({name:'resume.pdf',type:'application/pdf',data:`data:application/pdf;base64,${Buffer.from('%PDF-test').toString('base64')}`})},cookie);
    assert.equal(file.response.status,201);
    const downloaded=await fetch(`${base}/api/v1/files/${file.data.data.id}`,{headers:{Cookie:cookie}});
    assert.equal(downloaded.status,200);
    assert.equal(await downloaded.text(),'%PDF-test');

    const removed=await json(`/api/v1/applications/${applicationId}`,{method:'DELETE'},cookie);
    assert.equal(removed.response.status,204);
    const interviewRemoved=await json(`/api/v1/interviews/${interview.data.data.id}`,{method:'DELETE'},cookie);
    assert.equal(interviewRemoved.response.status,204);

    const reset=await json('/api/v1/workspace/reset',{method:'POST'},cookie);
    assert.equal(reset.response.status,200);
    assert.equal(reset.data.data.applications.length,0);

    const logout=await json('/api/v1/auth/logout',{method:'POST'},cookie);
    assert.equal(logout.response.status,204);
    console.log('PASS health auth privacy bootstrap profile applications tasks interviews AI documents files reset logout');
  } finally {
    server.kill();
    fs.rmSync(testDataDir,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);server.kill();fs.rmSync(testDataDir,{recursive:true,force:true});process.exitCode=1});
