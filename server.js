const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'dist');
function loadEnvFile() {
  const file=path.join(ROOT,'.env');
  if(!fs.existsSync(file))return;
  for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
    const match=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if(!match||process.env[match[1]]!==undefined)continue;
    let value=match[2];
    if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
    process.env[match[1]]=value;
  }
}
loadEnvFile();
const PORT = Number(process.env.PORT || 4173);
const DATA_DIR = process.env.FOLIO_DATA_DIR ? path.resolve(process.env.FOLIO_DATA_DIR) : path.join(ROOT, '.data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const IS_PROD = process.env.NODE_ENV === 'production';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const APP_ORIGIN = (process.env.APP_ORIGIN || '').replace(/\/$/,'');
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || '';
const DEV_AUTH_BYPASS = !IS_PROD && process.env.FOLIO_DEV_AUTH_BYPASS === 'true';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.md':'text/markdown; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.ico':'image/x-icon', '.woff':'font/woff', '.woff2':'font/woff2' };
const oauthStates = new Map();

function uid() { return crypto.randomUUID(); }
function now() { return new Date().toISOString(); }
function defaultWorkspace(name = '사용자', email = '') {
  return {
    profile: {
      name,
      englishName:'',
      role:'희망 직무를 입력하세요',
      target:'',
      summary:'',
      email,
      phone:'',
      birthDate:'',
      location:'',
      address:'',
      employmentType:'',
      desiredLocation:'',
      salary:'',
      availableDate:'',
      education:'',
      period:'',
      github:'',
      portfolio:'',
      blog:'',
      linkedin:'',
      links:[],
      skills:[],
      educations:[],
      experiences:[],
      projects:[],
      certifications:[],
      languages:[],
      awards:[]
    },
    stories: [], jobs: [], applications: [], tasks: [], docs: [], interviews: [], attachments: []
  };
}
function assertDataDirectoryWritable() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const probe = path.join(DATA_DIR, `.folio-write-check-${process.pid}-${crypto.randomBytes(4).toString('hex')}`);
  try {
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
  } catch (error) {
    console.error(`FOLIO_DATA_DIR is not writable: ${DATA_DIR}`);
    throw error;
  }
}
function loadDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) return { users:{}, sessions:{} };
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { return { users:{}, sessions:{} }; }
}
assertDataDirectoryWritable();
let db = loadDb();
function pruneExpiredSessions() {
  const current=Date.now();let changed=false;
  for(const [id,session] of Object.entries(db.sessions))if(new Date(session.expiresAt).getTime()<=current){delete db.sessions[id];changed=true;}
  for(const [state,pending] of oauthStates)if(pending.expiresAt<=current)oauthStates.delete(state);
  if(changed)saveDb();
}
function saveDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const temp = `${DB_FILE}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(db, null, 2));
  fs.renameSync(temp, DB_FILE);
}
function send(res, status, payload, headers = {}) {
  const body = payload == null ? '' : JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Content-Length':Buffer.byteLength(body), ...headers });
  res.end(body);
}
function ok(res, data, status = 200) { send(res, status, { data }); }
function fail(res, status, message, code = 'REQUEST_FAILED', details) { send(res, status, { message, code, details }); }
function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(v => { const i=v.indexOf('='); return [v.slice(0,i).trim(), decodeURIComponent(v.slice(i+1))]; }));
}
function sessionCookie(id, maxAge = 60 * 60 * 24 * 14) { return `folio_session=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${IS_PROD?'; Secure':''}`; }
function getUser(req) {
  const session = db.sessions[cookies(req).folio_session];
  if (!session || new Date(session.expiresAt) < new Date()) return null;
  return db.users[session.userId] || null;
}
function requireUser(req, res) { const user=getUser(req); if(!user) fail(res,401,'로그인이 필요합니다.','UNAUTHENTICATED'); return user; }
async function body(req) {
  const chunks=[]; let size=0;
  for await (const chunk of req) { size+=chunk.length; if(size>8_000_000) throw new Error('PAYLOAD_TOO_LARGE'); chunks.push(chunk); }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('INVALID_JSON'); }
}
function publicUser(user) { return { id:user.id, name:user.name, email:user.email, avatarUrl:user.avatarUrl || '' }; }
function removeUserUploads(userId) {
  const root=path.resolve(DATA_DIR,'uploads');
  const target=path.resolve(root,String(userId));
  if(target.startsWith(`${root}${path.sep}`)&&fs.existsSync(target))fs.rmSync(target,{recursive:true,force:true});
}
function exportWorkspace(user) {
  const workspace=structuredClone(user.workspace);
  workspace.attachments=(workspace.attachments||[]).map(({storageName,...item})=>item);
  return {format:'folio-export',version:1,exportedAt:now(),user:publicUser(user),workspace};
}
function createSession(userId) {
  const id = crypto.randomBytes(32).toString('base64url');
  db.sessions[id] = { userId, expiresAt:new Date(Date.now()+14*86400000).toISOString() };
  saveDb(); return id;
}
function upsertUser(identity) {
  let user = Object.values(db.users).find(u => u.providerId === identity.providerId || u.email === identity.email);
  if (!user) { user={ id:uid(), providerId:identity.providerId, name:identity.name, email:identity.email, avatarUrl:identity.avatarUrl||'', createdAt:now(), workspace:defaultWorkspace(identity.name,identity.email) }; db.users[user.id]=user; }
  else { Object.assign(user,{ name:identity.name, email:identity.email, avatarUrl:identity.avatarUrl||user.avatarUrl }); }
  saveDb(); return user;
}
function origin(req) { return APP_ORIGIN || `${req.headers['x-forwarded-proto'] || (IS_PROD?'https':'http')}://${req.headers.host}`; }
function googleRedirectUri(req) { return GOOGLE_REDIRECT_URI || `${origin(req)}/api/v1/auth/google/callback`; }
function safeReturnTo(value, req) { try { const url=new URL(value||'/',origin(req)); return url.origin===origin(req)?url.href:`${origin(req)}/`; } catch { return `${origin(req)}/`; } }

async function googleStart(req,res,url) {
  const returnTo=safeReturnTo(url.searchParams.get('returnTo'),req);
  if (DEV_AUTH_BYPASS) {
    const user=upsertUser({providerId:'local-google-demo',name:'Folio 사용자',email:'demo@folio.local'});
    const session=createSession(user.id);
    res.writeHead(302,{Location:returnTo,'Set-Cookie':sessionCookie(session)}); return res.end();
  }
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    if (IS_PROD) return fail(res,503,'Google OAuth 환경 변수가 설정되지 않았습니다.','GOOGLE_AUTH_NOT_CONFIGURED');
    const user=upsertUser({providerId:'local-google-demo',name:'Folio 사용자',email:'demo@folio.local'});
    const session=createSession(user.id);
    res.writeHead(302,{Location:returnTo,'Set-Cookie':sessionCookie(session)}); return res.end();
  }
  const state=crypto.randomBytes(24).toString('base64url');
  const verifier=crypto.randomBytes(48).toString('base64url');
  const challenge=crypto.createHash('sha256').update(verifier).digest('base64url');
  oauthStates.set(state,{returnTo,verifier,expiresAt:Date.now()+10*60_000});
  const params=new URLSearchParams({client_id:GOOGLE_CLIENT_ID,redirect_uri:googleRedirectUri(req),response_type:'code',scope:'openid email profile',state,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'});
  res.writeHead(302,{Location:`https://accounts.google.com/o/oauth2/v2/auth?${params}`}); res.end();
}
async function googleCallback(req,res,url) {
  const state=url.searchParams.get('state'), code=url.searchParams.get('code'), pending=oauthStates.get(state); oauthStates.delete(state);
  if(!pending || pending.expiresAt<Date.now() || !code) return fail(res,400,'유효하지 않은 로그인 요청입니다.','INVALID_OAUTH_STATE');
  const tokenRes=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:GOOGLE_CLIENT_ID,client_secret:GOOGLE_CLIENT_SECRET,code,code_verifier:pending.verifier,grant_type:'authorization_code',redirect_uri:googleRedirectUri(req)})});
  if(!tokenRes.ok) return fail(res,502,'Google 토큰 교환에 실패했습니다.','GOOGLE_TOKEN_FAILED');
  const tokens=await tokenRes.json();
  const infoRes=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${tokens.access_token}`}});
  if(!infoRes.ok) return fail(res,502,'Google 사용자 정보를 가져오지 못했습니다.','GOOGLE_PROFILE_FAILED');
  const info=await infoRes.json();
  const user=upsertUser({providerId:info.sub,name:info.name||info.email,email:info.email,avatarUrl:info.picture});
  const session=createSession(user.id);
  res.writeHead(302,{Location:pending.returnTo,'Set-Cookie':sessionCookie(session)}); res.end();
}

function extractResponseText(result) {
  if (typeof result.output_text === 'string') return result.output_text;
  return (result.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
}
async function openaiJson(instructions,input) {
  if(!OPENAI_API_KEY) return null;
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:OPENAI_MODEL,instructions,input})});
  if(!response.ok) throw new Error(`OPENAI_${response.status}`);
  const text=extractResponseText(await response.json()).replace(/^```json\s*|\s*```$/g,'');
  return JSON.parse(text);
}
function localAnalyze(description='') {
  const dictionary=['React','TypeScript','JavaScript','Next.js','Vue','Java','Spring','Python','AWS','Docker','Kubernetes','SQL','WebSocket','접근성','성능 최적화','디자인 시스템','A/B 테스트','사용자 경험','협업'];
  const skills=dictionary.filter(k=>description.toLowerCase().includes(k.toLowerCase()));
  return {skills,responsibilities:[],requirements:skills,preferredQualifications:[],source:'local'};
}
function localDocument(workspace,job) {
  const stories=workspace.stories.slice(0,3);
  const profileEvidence=[
    ...(workspace.profile?.experiences||[]).map(item=>[item.company,item.position,item.description,item.achievements].filter(Boolean).join(' · ')),
    ...(workspace.profile?.projects||[]).map(item=>[item.name,item.role,item.description,item.achievements].filter(Boolean).join(' · '))
  ].filter(Boolean).slice(0,3);
  const evidence=stories.length?stories.map(s=>`${s.title} 경험에서 ${s.summary}`):profileEvidence;
  const content=`${job.company}의 ${job.role} 직무에 지원하며, 사용자 문제를 구체적인 결과로 연결한 경험을 강조하고 싶습니다.\n\n${evidence.join('\n\n')||'내 정보에 경력과 프로젝트를 추가하면 사실 기반 초안을 더 구체적으로 만들 수 있습니다.'}\n\n이 경험을 바탕으로 팀과 함께 측정 가능한 제품 개선을 만들겠습니다.`;
  return {id:uid(),title:`${job.company} · 맞춤 지원서`,content,citations:stories.map((s,i)=>({sentence:i+2,careerStoryId:s.id})),warnings:evidence.length?[]:['연결할 경력 정보가 부족합니다.'],source:'local'};
}

async function api(req,res,url) {
  const method=req.method, route=url.pathname;
  if(method==='GET'&&route==='/api/v1/health') return ok(res,{status:'ok',googleConfigured:Boolean(GOOGLE_CLIENT_ID&&GOOGLE_CLIENT_SECRET),aiConfigured:Boolean(OPENAI_API_KEY)});
  if(method==='GET'&&route==='/api/v1/auth/google') return googleStart(req,res,url);
  if(method==='GET'&&route==='/api/v1/auth/google/callback') return googleCallback(req,res,url);
  if(method==='GET'&&route==='/api/v1/auth/session'){const user=requireUser(req,res);if(user)return ok(res,publicUser(user));return;}
  if(method==='POST'&&route==='/api/v1/auth/logout'){const id=cookies(req).folio_session;if(id)delete db.sessions[id];saveDb();res.writeHead(204,{'Set-Cookie':sessionCookie('',0)});return res.end();}
  const user=requireUser(req,res); if(!user)return; const w=user.workspace;
  if(method==='GET'&&route==='/api/v1/bootstrap') return ok(res,w);
  if(method==='GET'&&route==='/api/v1/account/export')return send(res,200,{data:exportWorkspace(user)},{'Content-Disposition':`attachment; filename="folio-export-${new Date().toISOString().slice(0,10)}.json"`,'Cache-Control':'no-store'});
  let fileMatch=route.match(/^\/api\/v1\/files\/([^/]+)$/);
  if(fileMatch&&method==='GET'){
    const item=(w.attachments||[]).find(x=>x.id===fileMatch[1]);if(!item)return fail(res,404,'파일을 찾을 수 없습니다.','NOT_FOUND');
    const filePath=path.join(DATA_DIR,'uploads',user.id,item.storageName);if(!fs.existsSync(filePath))return fail(res,404,'파일을 찾을 수 없습니다.','NOT_FOUND');
    res.writeHead(200,{'Content-Type':item.type||'application/octet-stream','Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(item.name)}`,'Content-Length':fs.statSync(filePath).size});return fs.createReadStream(filePath).pipe(res);
  }
  const payload=await body(req);
  if(method==='POST'&&route==='/api/v1/workspace/reset'){removeUserUploads(user.id);user.workspace=defaultWorkspace(user.name,user.email);saveDb();return ok(res,user.workspace);}
  if(method==='DELETE'&&route==='/api/v1/account'){
    removeUserUploads(user.id);
    for(const [id,session] of Object.entries(db.sessions))if(session.userId===user.id)delete db.sessions[id];
    delete db.users[user.id];saveDb();res.writeHead(204,{'Set-Cookie':sessionCookie('',0)});return res.end();
  }
  if(method==='PUT'&&route==='/api/v1/profile'){w.profile={...w.profile,...payload};saveDb();return ok(res,w.profile);}
  if(method==='POST'&&route==='/api/v1/career-stories'){const item={...payload,id:uid(),createdAt:now()};w.stories.unshift(item);saveDb();return ok(res,item,201);}
  if(method==='POST'&&route==='/api/v1/jobs'){const item={...payload,id:uid(),createdAt:now()};w.jobs.unshift(item);saveDb();return ok(res,item,201);}
  if(method==='POST'&&route==='/api/v1/applications'){let job=w.jobs.find(j=>j.id===payload.jobId);if(!job){job={id:uid(),company:payload.company,role:payload.role,deadline:payload.deadline||'',url:payload.url||'',description:'',skills:[]};w.jobs.unshift(job)}const item={id:uid(),jobId:job.id,status:payload.status||'관심',next:payload.next||'',memo:payload.memo||'',createdAt:now()};w.applications.unshift(item);saveDb();return ok(res,item,201);}
  if(method==='POST'&&route==='/api/v1/tasks'){const item={...payload,id:uid(),createdAt:now()};w.tasks.unshift(item);saveDb();return ok(res,item,201);}
  let taskMatch=route.match(/^\/api\/v1\/tasks\/([^/]+)$/);
  if(taskMatch&&method==='PATCH'){const item=w.tasks.find(x=>x.id===taskMatch[1]);if(!item)return fail(res,404,'할 일을 찾을 수 없습니다.','NOT_FOUND');Object.assign(item,payload,{updatedAt:now()});saveDb();return ok(res,item);}
  if(method==='POST'&&route==='/api/v1/interviews'){const item={...payload,id:uid(),createdAt:now()};w.interviews.push(item);w.interviews.sort((a,b)=>a.date.localeCompare(b.date));saveDb();return ok(res,item,201);}
  let interviewMatch=route.match(/^\/api\/v1\/interviews\/([^/]+)$/);
  if(interviewMatch&&method==='PATCH'){const item=w.interviews.find(x=>x.id===interviewMatch[1]);if(!item)return fail(res,404,'면접 일정을 찾을 수 없습니다.','NOT_FOUND');Object.assign(item,payload,{updatedAt:now()});w.interviews.sort((a,b)=>a.date.localeCompare(b.date));saveDb();return ok(res,item);}
  if(interviewMatch&&method==='DELETE'){const before=w.interviews.length;w.interviews=w.interviews.filter(x=>x.id!==interviewMatch[1]);if(before===w.interviews.length)return fail(res,404,'면접 일정을 찾을 수 없습니다.','NOT_FOUND');saveDb();res.writeHead(204);return res.end();}
  if(method==='POST'&&route==='/api/v1/files'){
    if(!payload.name||!payload.data)return fail(res,400,'파일 정보가 필요합니다.','INVALID_FILE');
    if(payload.type!=='application/pdf'||!String(payload.name).toLowerCase().endsWith('.pdf'))return fail(res,415,'PDF 파일만 업로드할 수 있습니다.','INVALID_FILE_TYPE');
    const raw=String(payload.data).replace(/^data:[^;]+;base64,/,'');const buffer=Buffer.from(raw,'base64');if(buffer.length>5_000_000)return fail(res,413,'파일은 5MB 이하여야 합니다.','FILE_TOO_LARGE');
    if(buffer.subarray(0,5).toString()!=='%PDF-')return fail(res,415,'올바른 PDF 파일이 아닙니다.','INVALID_FILE_CONTENT');
    const id=uid(),storageName=`${id}.bin`,dir=path.join(DATA_DIR,'uploads',user.id);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,storageName),buffer);
    const item={id,name:String(payload.name).slice(0,200),type:payload.type||'application/octet-stream',size:buffer.length,storageName,createdAt:now()};w.attachments=w.attachments||[];w.attachments.push(item);saveDb();return ok(res,item,201);
  }
  if(fileMatch&&method==='DELETE'){const index=(w.attachments||[]).findIndex(x=>x.id===fileMatch[1]);if(index<0)return fail(res,404,'파일을 찾을 수 없습니다.','NOT_FOUND');const [item]=w.attachments.splice(index,1);const filePath=path.join(DATA_DIR,'uploads',user.id,item.storageName);if(fs.existsSync(filePath))fs.unlinkSync(filePath);saveDb();res.writeHead(204);return res.end();}
  let match=route.match(/^\/api\/v1\/applications\/([^/]+)$/);
  if(match&&method==='PATCH'){const item=w.applications.find(x=>x.id===match[1]);if(!item)return fail(res,404,'지원 기록을 찾을 수 없습니다.','NOT_FOUND');Object.assign(item,payload,{updatedAt:now()});const job=w.jobs.find(j=>j.id===item.jobId);if(job)for(const key of ['company','role','deadline','url'])if(payload[key]!==undefined)job[key]=payload[key];saveDb();return ok(res,item);}
  if(match&&method==='DELETE'){const before=w.applications.length;w.applications=w.applications.filter(x=>x.id!==match[1]);if(before===w.applications.length)return fail(res,404,'지원 기록을 찾을 수 없습니다.','NOT_FOUND');saveDb();res.writeHead(204);return res.end();}
  if(method==='POST'&&route==='/api/v1/documents'){const item={...payload,id:uid(),createdAt:now(),updatedAt:now()};w.docs.unshift(item);saveDb();return ok(res,item,201);}
  match=route.match(/^\/api\/v1\/documents\/([^/]+)$/);
  if(match&&method==='PUT'){const item=w.docs.find(x=>x.id===match[1]);if(!item)return fail(res,404,'문서를 찾을 수 없습니다.','NOT_FOUND');Object.assign(item,payload,{updatedAt:now()});saveDb();return ok(res,item);}
  if(method==='POST'&&route==='/api/v1/ai/jobs/analyze'){let result;try{result=await openaiJson('채용 공고를 분석해 JSON만 출력하세요. 키: skills, responsibilities, requirements, preferredQualifications. 모든 값은 문자열 배열이며 원문에 없는 사실을 만들지 마세요.',payload.description||'')}catch(e){console.error(e);result=null}return ok(res,result||localAnalyze(payload.description));}
  if(method==='POST'&&route==='/api/v1/ai/documents/generate'){const job=w.jobs.find(j=>j.id===payload.jobId);if(!job)return fail(res,404,'공고를 찾을 수 없습니다.','NOT_FOUND');const selected=w.stories.filter(s=>(payload.careerStoryIds||[]).includes(s.id));let result;try{result=await openaiJson('사용자가 제공한 사실만 사용해 한국어 자기소개서 초안을 작성하고 JSON만 출력하세요. 키: title, content, citations, warnings. 근거 없는 성과나 수치를 만들지 마세요.',JSON.stringify({job,profile:w.profile,careerStories:selected}))}catch(e){console.error(e);result=null}const item={...(result||localDocument(w,job)),id:uid(),jobId:job.id,createdAt:now(),updatedAt:now()};w.docs.unshift(item);saveDb();return ok(res,item,201);}
  return fail(res,404,'API 경로를 찾을 수 없습니다.','NOT_FOUND');
}

function staticFile(req,res,url) {
  const file=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if(file.split('/').some(part=>part.startsWith('.'))){res.writeHead(404);return res.end('Not found');}
  if(!fs.existsSync(PUBLIC_DIR)){res.writeHead(503,{'Content-Type':'text/plain; charset=utf-8'});return res.end('Frontend build is not available. Run npm run build.');}
  let target=path.resolve(PUBLIC_DIR,file);
  if(target!==PUBLIC_DIR&&!target.startsWith(PUBLIC_DIR+path.sep)){res.writeHead(403);return res.end('Forbidden');}
  if(!fs.existsSync(target)||fs.statSync(target).isDirectory()){
    if(path.extname(file)||file.startsWith('.')){res.writeHead(404);return res.end('Not found');}
    target=path.join(PUBLIC_DIR,'index.html');
  }
  fs.readFile(target,(err,data)=>{if(err){res.writeHead(404);return res.end('Not found');}const hashedAsset=target.includes(`${path.sep}assets${path.sep}`);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':IS_PROD?(hashedAsset?'public, max-age=31536000, immutable':'public, max-age=300'):'no-store'});res.end(data);});
}

const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  if(IS_PROD)res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
  if(req.url.startsWith('/api/v1/'))res.setHeader('Cache-Control','no-store');
  const url=new URL(req.url,origin(req));
  try { if(url.pathname.startsWith('/api/v1/'))await api(req,res,url); else staticFile(req,res,url); }
  catch(error){console.error(error);if(!res.headersSent)fail(res,error.message==='PAYLOAD_TOO_LARGE'?413:400,error.message==='INVALID_JSON'?'JSON 형식이 올바르지 않습니다.':'요청 처리 중 오류가 발생했습니다.','SERVER_ERROR');}
});
pruneExpiredSessions();
const sessionCleanup=setInterval(pruneExpiredSessions,60*60_000);sessionCleanup.unref();
server.listen(PORT,()=>{
  console.log(`Folio is running at http://localhost:${PORT}`);
  if(IS_PROD&&!APP_ORIGIN)console.warn('APP_ORIGIN is recommended in production.');
  if(IS_PROD&&(!GOOGLE_CLIENT_ID||!GOOGLE_CLIENT_SECRET))console.warn('Google OAuth is not configured.');
});
function shutdown(signal){console.log(`${signal} received, shutting down.`);clearInterval(sessionCleanup);server.close(()=>{saveDb();process.exit(0)});setTimeout(()=>process.exit(1),10_000).unref();}
process.on('SIGTERM',()=>shutdown('SIGTERM'));
process.on('SIGINT',()=>shutdown('SIGINT'));
