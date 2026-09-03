const { spawn } = require('child_process');
const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const port = 4187;
const base = `http://localhost:${port}`;
const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(),'folio-test-'));
const server = spawn(process.execPath, ['server.js'], { cwd:__dirname, env:{...process.env,PORT:String(port),NODE_ENV:'development',FOLIO_DATA_DIR:testDataDir,GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:'',AI_PROVIDER:'openai',GEMINI_API_KEY:'',OPENAI_API_KEY:''}, stdio:['ignore','pipe','pipe'] });

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function stopServer(){
  if(server.exitCode!==null)return;
  const exited=new Promise(resolve=>server.once('exit',resolve));
  server.kill('SIGTERM');
  await Promise.race([exited,wait(3000)]);
}
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
    assert.equal(health.response.headers.get('x-content-type-options'),'nosniff');
    assert.equal(health.response.headers.get('x-frame-options'),'DENY');
    assert.match(health.response.headers.get('content-security-policy'),/frame-ancestors 'none'/);
    assert.equal(health.response.headers.get('cache-control'),'no-store');

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

    const profile=await json('/api/v1/profile',{method:'PUT',body:JSON.stringify({
      name:'테스트 사용자',
      role:'Frontend Developer',
      summary:'사용자 문제를 해결하는 개발자',
      educations:[{school:'테스트대학교',major:'컴퓨터공학',startDate:'2020-03',endDate:'2026-02'}],
      experiences:[{company:'테스트 회사',position:'개발자',description:'제품 개발'}],
      projects:[{name:'Folio',role:'Frontend',tech:'JavaScript'}],
      certifications:[{name:'정보처리기사',issuer:'한국산업인력공단'}]
    })},cookie);
    assert.equal(profile.data.data.name,'테스트 사용자');
    assert.equal(profile.data.data.educations[0].major,'컴퓨터공학');
    assert.equal(profile.data.data.experiences[0].company,'테스트 회사');

    const careerSource=await json('/api/v1/career-sources',{method:'POST',body:JSON.stringify({name:'텍스트 이력서',type:'resume',rawText:'테스트 회사에서 React 제품 개발과 성능 개선을 담당했습니다.'})},cookie);
    assert.equal(careerSource.response.status,201);
    const extracted=await json(`/api/v1/career-sources/${careerSource.data.data.id}/extract`,{method:'POST'},cookie);
    assert.equal(extracted.response.status,200);
    assert.equal(extracted.data.data.facts.length,1);
    assert.equal(extracted.data.data.facts[0].status,'review');
    const careerFactId=extracted.data.data.facts[0].id;
    const verifiedFact=await json(`/api/v1/career-facts/${careerFactId}`,{method:'PATCH',body:JSON.stringify({status:'verified',title:'React 제품 개발'})},cookie);
    assert.equal(verifiedFact.data.data.status,'verified');
    const manualFact=await json('/api/v1/career-facts',{method:'POST',body:JSON.stringify({category:'project',title:'Folio',organization:'개인 프로젝트',period:'2026',description:'커리어 데이터 관리',achievements:'LLM용 데이터 정리',skills:['React'],sourceIds:[],status:'verified',sensitive:false})},cookie);
    assert.equal(manualFact.response.status,201);
    assert.equal(manualFact.data.data.title,'Folio');

    const created=await json('/api/v1/applications',{method:'POST',body:JSON.stringify({company:'테스트 회사',role:'개발자',status:'작성 중',deadline:'2026-09-01',next:'지원서 작성',applicationFitScore:99,compensationScore:99,companyScore:99})},cookie);
    assert.equal(created.response.status,201);
    assert.equal(created.data.data.applicationFitScore,25);
    assert.equal(created.data.data.compensationScore,15);
    assert.equal(created.data.data.companyScore,5);
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

    const job=await json('/api/v1/jobs',{method:'POST',body:JSON.stringify({company:'AI 회사',role:'Frontend',description:'React와 TypeScript 협업 경험',deadline:'2026-09-02',alwaysOpen:true,skills:[]})},cookie);
    assert.equal(job.data.data.alwaysOpen,true);
    assert.equal(job.data.data.deadline,'');
    const analysis=await json('/api/v1/ai/jobs/analyze',{method:'POST',body:JSON.stringify({description:'React와 TypeScript 협업 경험'})},cookie);
    assert.deepEqual(analysis.data.data.skills,['React','TypeScript','협업']);

    const document=await json('/api/v1/ai/documents/generate',{method:'POST',body:JSON.stringify({jobId:job.data.data.id,careerStoryIds:[]})},cookie);
    assert.equal(document.response.status,201);
    assert.ok(document.data.data.content.length>20);

    const vaultNote=await json('/api/v1/vault-notes',{method:'POST',body:JSON.stringify({title:'범용 프롬프트',content:'초안'})},cookie);
    assert.equal(vaultNote.response.status,201);
    const vaultNoteUpdated=await json(`/api/v1/vault-notes/${vaultNote.data.data.id}`,{method:'PUT',body:JSON.stringify({title:'범용 프롬프트',content:'수정한 프롬프트'})},cookie);
    assert.equal(vaultNoteUpdated.data.data.content,'수정한 프롬프트');

    const invalidFile=await json('/api/v1/files',{method:'POST',body:JSON.stringify({name:'fake.pdf',type:'application/pdf',data:`data:application/pdf;base64,${Buffer.from('not-a-pdf').toString('base64')}`})},cookie);
    assert.equal(invalidFile.response.status,415);

    const file=await json('/api/v1/files',{method:'POST',body:JSON.stringify({name:'resume.pdf',type:'application/pdf',data:`data:application/pdf;base64,${Buffer.from('%PDF-test').toString('base64')}`})},cookie);
    assert.equal(file.response.status,201);
    const downloaded=await fetch(`${base}/api/v1/files/${file.data.data.id}`,{headers:{Cookie:cookie}});
    assert.equal(downloaded.status,200);
    assert.equal(await downloaded.text(),'%PDF-test');

    const exported=await json('/api/v1/account/export',{},cookie);
    assert.equal(exported.response.status,200);
    assert.equal(exported.data.data.format,'folio-export');
    assert.equal(exported.data.data.version,1);
    assert.equal(exported.data.data.workspace.attachments[0].name,'resume.pdf');
    assert.equal(exported.data.data.workspace.vaultNotes[0].title,'범용 프롬프트');
    assert.equal('storageName' in exported.data.data.workspace.attachments[0],false);
    assert.match(exported.response.headers.get('content-disposition'),/attachment/);

    const pngBytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Xw2jWQAAAABJRU5ErkJggg==','base64');
    const mismatchedImage=await json('/api/v1/files',{method:'POST',body:JSON.stringify({name:'clipboard-image.jpg',type:'image/jpeg',data:`data:image/jpeg;base64,${pngBytes.toString('base64')}`})},cookie);
    assert.equal(mismatchedImage.response.status,201);
    assert.equal(mismatchedImage.data.data.type,'image/png');
    const renamedImage=await json(`/api/v1/files/${mismatchedImage.data.data.id}`,{method:'PATCH',body:JSON.stringify({name:'캡처 이미지.png'})},cookie);
    assert.equal(renamedImage.response.status,200);
    assert.equal(renamedImage.data.data.name,'캡처 이미지.png');
    const dibBytes=Buffer.alloc(44);dibBytes.writeUInt32LE(40,0);dibBytes.writeInt32LE(1,4);dibBytes.writeInt32LE(1,8);dibBytes.writeUInt16LE(1,12);dibBytes.writeUInt16LE(32,14);dibBytes.writeUInt32LE(4,20);
    const clipboardDib=await json('/api/v1/files',{method:'POST',body:JSON.stringify({name:'clipboard-capture.png',type:'image/png',data:`data:image/png;base64,${dibBytes.toString('base64')}`})},cookie);
    assert.equal(clipboardDib.response.status,201);
    assert.equal(clipboardDib.data.data.type,'image/bmp');

    const removed=await json(`/api/v1/applications/${applicationId}`,{method:'DELETE'},cookie);
    assert.equal(removed.response.status,204);
    const interviewRemoved=await json(`/api/v1/interviews/${interview.data.data.id}`,{method:'DELETE'},cookie);
    assert.equal(interviewRemoved.response.status,204);
    const vaultNoteRemoved=await json(`/api/v1/vault-notes/${vaultNote.data.data.id}`,{method:'DELETE'},cookie);
    assert.equal(vaultNoteRemoved.response.status,204);

    const reset=await json('/api/v1/workspace/reset',{method:'POST'},cookie);
    assert.equal(reset.response.status,200);
    assert.equal(reset.data.data.applications.length,0);
    const removedFile=await fetch(`${base}/api/v1/files/${file.data.data.id}`,{headers:{Cookie:cookie}});
    assert.equal(removedFile.status,404);
    assert.equal(fs.existsSync(path.join(testDataDir,'uploads',session.data.data.id)),false);

    const logout=await json('/api/v1/auth/logout',{method:'POST'},cookie);
    assert.equal(logout.response.status,204);
    const relogin=await fetch(`${base}/api/v1/auth/google?returnTo=${encodeURIComponent(base+'/')}`,{redirect:'manual'});
    const secondCookie=relogin.headers.get('set-cookie').split(';')[0];
    const secondSession=await json('/api/v1/auth/session',{},secondCookie);
    const secondFile=await json('/api/v1/files',{method:'POST',body:JSON.stringify({name:'delete-with-account.pdf',type:'application/pdf',data:`data:application/pdf;base64,${Buffer.from('%PDF-account-delete').toString('base64')}`})},secondCookie);
    assert.equal(secondFile.response.status,201);
    const secondUploadDir=path.join(testDataDir,'uploads',secondSession.data.data.id);
    assert.equal(fs.existsSync(secondUploadDir),true);
    const deleted=await json('/api/v1/account',{method:'DELETE'},secondCookie);
    assert.equal(deleted.response.status,204);
    assert.equal(fs.existsSync(secondUploadDir),false);
    const deletedSession=await json('/api/v1/auth/session',{},secondCookie);
    assert.equal(deletedSession.response.status,401);
    console.log('PASS health security auth privacy bootstrap profile career-vault universal-vault applications tasks interviews AI documents files export reset logout account-delete');
  } finally {
    await stopServer();
    fs.rmSync(testDataDir,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1});
