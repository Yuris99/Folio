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
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.4-mini';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_DEFAULT_MODEL = process.env.GEMINI_DEFAULT_MODEL || 'gemini-2.5-flash';
const GEMINI_EXTRACTION_MODEL = process.env.GEMINI_EXTRACTION_MODEL || GEMINI_DEFAULT_MODEL;
const AI_PROVIDER = (process.env.AI_PROVIDER || (GEMINI_API_KEY ? 'gemini' : 'openai')).toLowerCase();
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.md':'text/markdown; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.ico':'image/x-icon', '.woff':'font/woff', '.woff2':'font/woff2' };
const oauthStates = new Map();

function uid() { return crypto.randomUUID(); }
function now() { return new Date().toISOString(); }
function defaultWorkspace(name = '사용자', email = '') {
  return {
    profile: {
      name,
      englishName:'',
      role:'',
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
      awards:[],
      activities:[],
      militaryServices:[]
    },
    stories: [], jobs: [], applications: [], tasks: [], docs: [], interviews: [], attachments: [], consultations: [],
    careerVaultVersion:1, careerSources:[], careerFacts:[]
  };
}
function careerFact(category,title,organization='',period='',description='',achievements='',skills=[]) {
  return {id:uid(),category,title:String(title||'').trim(),organization:String(organization||'').trim(),period:String(period||'').trim(),description:String(description||'').trim(),achievements:String(achievements||'').trim(),skills:(skills||[]).filter(Boolean),sourceIds:[],status:'verified',sensitive:false,createdAt:now(),updatedAt:now()};
}
function ensureCareerVault(workspace) {
  if(workspace.careerVaultVersion===1&&Array.isArray(workspace.careerSources)&&Array.isArray(workspace.careerFacts))return false;
  workspace.careerSources=(workspace.attachments||[]).map(file=>({id:uid(),name:file.name,type:'resume',attachmentId:file.id,status:'ready',createdAt:file.createdAt||now()}));
  const p=workspace.profile||{}, facts=[];
  for(const item of p.educations||[])if(item.school)facts.push(careerFact('education',item.school,item.major,[item.startDate,item.endDate].filter(Boolean).join(' ~ '),[item.degree,item.status,item.gpa,item.description].filter(Boolean).join(' · ')));
  for(const item of p.experiences||[])if(item.company||item.position)facts.push(careerFact('experience',item.position||item.company,item.company,[item.startDate,item.endDate].filter(Boolean).join(' ~ '),[item.department,item.employmentType,item.description].filter(Boolean).join(' · '),item.achievements));
  for(const item of p.projects||[])if(item.name)facts.push(careerFact('project',item.name,item.organization,[item.startDate,item.endDate].filter(Boolean).join(' ~ '),[item.role,item.description,item.url].filter(Boolean).join(' · '),item.achievements,String(item.tech||'').split(',').map(x=>x.trim())));
  for(const item of p.certifications||[])if(item.name)facts.push(careerFact('certification',item.name,item.issuer,item.acquiredDate,item.credentialId));
  for(const item of p.languages||[])if(item.name)facts.push(careerFact('language',item.name,'',item.acquiredDate,[item.level,item.score].filter(Boolean).join(' · ')));
  for(const item of p.awards||[])if(item.name)facts.push(careerFact('activity',item.name,item.issuer,item.date,item.description));
  if((p.skills||[]).length)facts.push(careerFact('skill','보유 기술','','','검증된 기술 및 도구','',p.skills));
  workspace.careerFacts=facts;
  workspace.careerVaultVersion=1;
  return true;
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
async function geminiJson(instructions,input,model=GEMINI_DEFAULT_MODEL) {
  if(!GEMINI_API_KEY)return null;
  const parts=Array.isArray(input)?input:[{text:String(input)}];
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'x-goog-api-key':GEMINI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:instructions}]},contents:[{role:'user',parts}],generationConfig:{responseMimeType:'application/json'}})});
  if(!response.ok)throw new Error(`GEMINI_${response.status}`);
  const result=await response.json();
  const text=(result.candidates?.[0]?.content?.parts||[]).map(part=>part.text||'').join('').replace(/^```json\s*|\s*```$/g,'');
  if(!text)throw new Error('GEMINI_EMPTY_RESPONSE');
  return JSON.parse(text);
}
async function aiJson(instructions,input,model) {
  return AI_PROVIDER==='gemini'?geminiJson(instructions,input,model):openaiJson(instructions,input);
}
const careerCategories=new Set(['profile','education','experience','project','skill','certification','language','activity','other']);
function normalizeExtractedFact(item,sourceId) {
  const category=careerCategories.has(item?.category)?item.category:'other';
  return {id:uid(),category,title:String(item?.title||'확인할 정보').slice(0,200),organization:String(item?.organization||'').slice(0,200),period:String(item?.period||'').slice(0,100),description:String(item?.description||'').slice(0,10000),achievements:String(item?.achievements||'').slice(0,5000),skills:(Array.isArray(item?.skills)?item.skills:[]).map(String).map(x=>x.trim()).filter(Boolean).slice(0,30),sourceIds:[sourceId],status:'review',sensitive:Boolean(item?.sensitive),createdAt:now(),updatedAt:now()};
}
async function extractCareerFacts(user,source) {
  const instructions='이력서 또는 포트폴리오에서 확인 가능한 사실만 추출해 JSON만 출력하세요. 형식: {"facts":[{"category":"profile|education|experience|project|skill|certification|language|activity|other","title":"","organization":"","period":"","description":"","achievements":"","skills":[],"sensitive":false}]}. 회사, 프로젝트, 학력은 각각 한 항목으로 분리하고 날짜와 수치를 원문 그대로 보존하세요. 추측하거나 내용을 보완하지 마세요. 이메일, 전화번호, 생년월일, 주소는 sensitive=true로 표시하세요.';
  let input='', canFallback=false, pdf=null;
  if(source.rawText){input=source.rawText;canFallback=true;}
  else if(source.attachmentId){
    const file=(user.workspace.attachments||[]).find(x=>x.id===source.attachmentId);
    if(file){const filePath=path.join(DATA_DIR,'uploads',user.id,file.storageName);if(fs.existsSync(filePath)){const data=fs.readFileSync(filePath).toString('base64');pdf={name:file.name,data};}}
  }
  let result=null;
  try{
    if(input)result=await aiJson(instructions,input,GEMINI_EXTRACTION_MODEL);
    else if(pdf&&AI_PROVIDER==='gemini')result=await geminiJson(instructions,[{inlineData:{mimeType:'application/pdf',data:pdf.data}},{text:'이 PDF의 커리어 정보를 구조화하세요.'}],GEMINI_EXTRACTION_MODEL);
    else if(pdf)result=await openaiJson(instructions,[{role:'user',content:[{type:'input_file',filename:pdf.name,file_data:`data:application/pdf;base64,${pdf.data}`},{type:'input_text',text:'이 PDF의 커리어 정보를 구조화하세요.'}]}]);
  }catch(error){console.error('career extraction failed',error);}
  let items=Array.isArray(result?.facts)?result.facts:[];
  if(!items.length&&canFallback&&String(source.rawText).trim())items=[{category:'other',title:source.name,description:String(source.rawText).trim().slice(0,10000),skills:[],sensitive:false}];
  return items.map(item=>normalizeExtractedFact(item,source.id));
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
  if(method==='GET'&&route==='/api/v1/health') return ok(res,{status:'ok',googleConfigured:Boolean(GOOGLE_CLIENT_ID&&GOOGLE_CLIENT_SECRET),aiProvider:AI_PROVIDER,aiConfigured:AI_PROVIDER==='gemini'?Boolean(GEMINI_API_KEY):Boolean(OPENAI_API_KEY)});
  if(method==='GET'&&route==='/api/v1/auth/google') return googleStart(req,res,url);
  if(method==='GET'&&route==='/api/v1/auth/google/callback') return googleCallback(req,res,url);
  if(method==='GET'&&route==='/api/v1/auth/session'){const user=requireUser(req,res);if(user)return ok(res,publicUser(user));return;}
  if(method==='POST'&&route==='/api/v1/auth/logout'){const id=cookies(req).folio_session;if(id)delete db.sessions[id];saveDb();res.writeHead(204,{'Set-Cookie':sessionCookie('',0)});return res.end();}
  const user=requireUser(req,res); if(!user)return; const w=user.workspace;
  if(!Array.isArray(w.consultations))w.consultations=[];
  if(ensureCareerVault(w))saveDb();
  if(method==='GET'&&route==='/api/v1/bootstrap') return ok(res,w);
  if(method==='GET'&&route==='/api/v1/account/export')return send(res,200,{data:exportWorkspace(user)},{'Content-Disposition':`attachment; filename="folio-export-${new Date().toISOString().slice(0,10)}.json"`,'Cache-Control':'no-store'});
  let fileMatch=route.match(/^\/api\/v1\/files\/([^/]+)$/);
  if(fileMatch&&method==='GET'){
    const item=(w.attachments||[]).find(x=>x.id===fileMatch[1]);if(!item)return fail(res,404,'파일을 찾을 수 없습니다.','NOT_FOUND');
    const filePath=path.join(DATA_DIR,'uploads',user.id,item.storageName);if(!fs.existsSync(filePath))return fail(res,404,'파일을 찾을 수 없습니다.','NOT_FOUND');
    res.writeHead(200,{'Content-Type':item.type||'application/octet-stream','Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(item.name)}`,'Content-Length':fs.statSync(filePath).size});return fs.createReadStream(filePath).pipe(res);
  }
  const payload=await body(req);
  if(method==='POST'&&route==='/api/v1/chat-import'){
    const kinds=new Set(['applications','company-analysis','interviews','documents','tasks']);
    if(payload?.format!=='folio-chat-import'||payload?.version!==1||!kinds.has(payload?.kind)||!payload.data||typeof payload.data!=='object'||Array.isArray(payload.data))return fail(res,400,'Folio 채팅 가져오기 형식이 올바르지 않습니다.','INVALID_CHAT_IMPORT');
    for(const value of Object.values(payload.data))if(!Array.isArray(value))return fail(res,400,'가져오기 항목은 배열이어야 합니다.','INVALID_CHAT_IMPORT_LIST');
    const clean=(value,max=10000)=>String(value??'').trim().slice(0,max);
    let total=0,skippedDuplicates=0;
    const findJob=(company,role)=>w.jobs.find(job=>clean(job.company).toLowerCase()===clean(company).toLowerCase()&&clean(job.role).toLowerCase()===clean(role).toLowerCase());
    const ensureJob=(company,role)=>{let job=findJob(company,role);if(!job&&clean(company)){job={id:uid(),company:clean(company,200),role:clean(role,200),deadline:'',url:'',description:'',skills:[],createdAt:now()};w.jobs.unshift(job);total++;}return job;};
    if(payload.kind==='applications'){
      for(const raw of payload.data.jobs||[]){if(!raw||typeof raw!=='object'||!clean(raw.company))continue;if(findJob(raw.company,raw.role)){skippedDuplicates++;continue;}w.jobs.unshift({id:uid(),company:clean(raw.company,200),role:clean(raw.role,200),deadline:clean(raw.deadline,50),url:clean(raw.url,2000),description:clean(raw.description),skills:(Array.isArray(raw.skills)?raw.skills:[]).map(x=>clean(x,100)).filter(Boolean).slice(0,50),createdAt:now()});total++;}
      const statuses=new Set(['관심','작성 중','지원 완료','서류 통과','면접','합격','탈락']);
      for(const raw of payload.data.applications||[]){if(!raw||typeof raw!=='object')continue;const job=ensureJob(raw.company,raw.role);if(!job)continue;if(w.applications.some(item=>item.jobId===job.id)){skippedDuplicates++;continue;}w.applications.unshift({id:uid(),jobId:job.id,status:statuses.has(raw.status)?raw.status:'관심',next:clean(raw.next,500),memo:clean(raw.memo,5000),createdAt:now(),updatedAt:now()});total++;}
    }
    if(payload.kind==='company-analysis')for(const raw of payload.data.analyses||[]){if(!raw||typeof raw!=='object'||!clean(raw.company))continue;const job=ensureJob(raw.company,raw.role);if(!job)continue;const list=(value,max=100)=>Array.isArray(value)?value.map(x=>clean(x,1000)).filter(Boolean).slice(0,max):[];job.companyAnalysis={overview:clean(raw.overview,20000),products:list(raw.products),industry:clean(raw.industry,500),culture:list(raw.culture),recentTopics:list(raw.recentTopics),roleResponsibilities:list(raw.roleResponsibilities),requirements:list(raw.requirements),preferred:list(raw.preferred),fitEvidence:list(raw.fitEvidence),gaps:list(raw.gaps),interviewTopics:list(raw.interviewTopics),sources:(Array.isArray(raw.sources)?raw.sources:[]).map(source=>({title:clean(source?.title,500),url:clean(source?.url,2000)})).filter(source=>source.title||source.url).slice(0,100),analyzedAt:now()};job.skills=[...new Set([...(job.skills||[]),...job.companyAnalysis.requirements,...job.companyAnalysis.preferred])].slice(0,100);total++;}
    if(payload.kind==='interviews')for(const raw of payload.data.interviews||[]){if(!raw||typeof raw!=='object'||!clean(raw.company))continue;const key=[raw.company,raw.role,raw.date,raw.type].map(x=>clean(x).toLowerCase()).join('|');if(w.interviews.some(item=>[item.company,item.role,item.date,item.type].map(x=>clean(x).toLowerCase()).join('|')===key)){skippedDuplicates++;continue;}w.interviews.push({id:uid(),company:clean(raw.company,200),role:clean(raw.role,200),date:clean(raw.date,50),type:clean(raw.type,100)||'기타',memo:clean(raw.memo,5000),prepared:Math.max(0,Math.min(100,Number(raw.prepared)||0)),createdAt:now()});total++;}
    if(payload.kind==='interviews')w.interviews.sort((a,b)=>a.date.localeCompare(b.date));
    if(payload.kind==='documents')for(const raw of payload.data.documents||[]){if(!raw||typeof raw!=='object'||!clean(raw.title)||!clean(raw.content))continue;const title=clean(raw.title,300),content=clean(raw.content,50000);if(w.docs.some(item=>clean(item.title).toLowerCase()===title.toLowerCase()&&clean(item.content)===content)){skippedDuplicates++;continue;}const job=clean(raw.company)?ensureJob(raw.company,raw.role):null;w.docs.unshift({id:uid(),title,jobId:job?.id,content,warnings:(Array.isArray(raw.warnings)?raw.warnings:[]).map(x=>clean(x,500)).filter(Boolean),createdAt:now(),updatedAt:now()});total++;}
    if(payload.kind==='tasks')for(const raw of payload.data.tasks||[]){if(!raw||typeof raw!=='object'||!clean(raw.text))continue;const text=clean(raw.text,1000),date=clean(raw.date,50);if(w.tasks.some(item=>clean(item.text).toLowerCase()===text.toLowerCase()&&clean(item.date)===date)){skippedDuplicates++;continue;}w.tasks.unshift({id:uid(),text,date,done:Boolean(raw.done),createdAt:now()});total++;}
    saveDb();return ok(res,{workspace:w,imported:{total,skippedDuplicates}});
  }
  if(method==='POST'&&route==='/api/v1/career-import'){
    if(payload?.format!=='folio-career-import'||payload?.version!==1)return fail(res,400,'Folio 커리어 가져오기 형식이 올바르지 않습니다.','INVALID_IMPORT_FORMAT');
    const listKeys=['educations','experiences','projects','certifications','languages','awards','activities','militaryServices'];
    if(payload.profile!==undefined&&(typeof payload.profile!=='object'||Array.isArray(payload.profile)))return fail(res,400,'profile 형식이 올바르지 않습니다.','INVALID_IMPORT_PROFILE');
    for(const key of [...listKeys,'careerFacts'])if(payload[key]!==undefined&&!Array.isArray(payload[key]))return fail(res,400,`${key}는 배열이어야 합니다.`,'INVALID_IMPORT_LIST');
    const cleanText=(value,max=10000)=>String(value??'').trim().slice(0,max);
    const profileKeys=['name','englishName','role','target','summary','email','phone','birthDate','location','address','github','portfolio','blog','linkedin'];
    let profileFields=0,profileItems=0,skippedDuplicates=0;
    for(const key of profileKeys){const value=cleanText(payload.profile?.[key]);if(value&&!w.profile[key]){w.profile[key]=value;profileFields++;}}
    const incomingSkills=Array.isArray(payload.profile?.skills)?payload.profile.skills.map(x=>cleanText(x,100)).filter(Boolean):[];
    const knownSkills=new Set((w.profile.skills||[]).map(x=>String(x).toLowerCase()));
    for(const skill of incomingSkills)if(!knownSkills.has(skill.toLowerCase())){w.profile.skills.push(skill);knownSkills.add(skill.toLowerCase());profileFields++;}
    const identityKeys={educations:['school','major','startDate'],experiences:['company','position','startDate'],projects:['name','organization','startDate'],certifications:['name','issuer','acquiredDate'],languages:['name','level','score'],awards:['name','issuer','date'],activities:['name','organization','startDate'],militaryServices:['branch','role','startDate']};
    for(const key of listKeys){
      const target=Array.isArray(w.profile[key])?w.profile[key]:(w.profile[key]=[]);
      const identity=item=>identityKeys[key].map(field=>cleanText(item?.[field],200).toLowerCase()).join('|');
      const known=new Set(target.map(identity));
      for(const raw of payload[key]||[]){if(!raw||typeof raw!=='object'||Array.isArray(raw))continue;const item={};for(const [field,value] of Object.entries(raw))item[field]=Array.isArray(value)?value.map(x=>cleanText(x,100)).filter(Boolean):cleanText(value);const id=identity(item);if(!id.replaceAll('|',''))continue;if(known.has(id)){skippedDuplicates++;continue;}target.push(item);known.add(id);profileItems++;}
    }
    const source={id:uid(),name:`AI 채팅 가져오기 ${new Date().toISOString().slice(0,10)}`,type:'career-note',status:'review',createdAt:now()};
    const suppliedFacts=Array.isArray(payload.careerFacts)?payload.careerFacts.filter(x=>x&&typeof x==='object'&&!Array.isArray(x)):[];
    const derived=[];
    if(!suppliedFacts.length){
      for(const item of payload.educations||[])if(item?.school)derived.push({category:'education',title:item.school,organization:item.school,period:[item.startDate,item.endDate].filter(Boolean).join(' ~ '),description:[item.major,item.degree,item.status,item.description].filter(Boolean).join(' · ')});
      for(const item of payload.experiences||[])if(item?.company||item?.position)derived.push({category:'experience',title:item.position||item.company,organization:item.company,period:[item.startDate,item.endDate].filter(Boolean).join(' ~ '),description:[item.department,item.employmentType,item.description].filter(Boolean).join(' · '),achievements:item.achievements});
      for(const item of payload.projects||[])if(item?.name)derived.push({category:'project',title:item.name,organization:item.organization,period:[item.startDate,item.endDate].filter(Boolean).join(' ~ '),description:[item.role,item.description,item.url].filter(Boolean).join(' · '),achievements:item.achievements,skills:cleanText(item.tech).split(',').map(x=>x.trim()).filter(Boolean)});
      for(const item of payload.certifications||[])if(item?.name)derived.push({category:'certification',title:item.name,organization:item.issuer,period:item.acquiredDate,description:item.credentialId});
      for(const item of payload.languages||[])if(item?.name)derived.push({category:'language',title:item.name,period:item.acquiredDate,description:[item.level,item.score].filter(Boolean).join(' · ')});
      for(const item of payload.awards||[])if(item?.name)derived.push({category:'activity',title:item.name,organization:item.issuer,period:item.date,description:item.description});
    }
    const candidates=suppliedFacts.length?suppliedFacts:derived;
    const knownFacts=new Set(w.careerFacts.filter(x=>x.status!=='excluded').map(x=>`${x.category}|${String(x.title).trim().toLowerCase()}|${String(x.organization).trim().toLowerCase()}|${String(x.period).trim().toLowerCase()}`));
    const facts=[];
    for(const raw of candidates){const fact=normalizeExtractedFact(raw,source.id);if(!fact.title.trim())continue;const key=`${fact.category}|${fact.title.toLowerCase()}|${fact.organization.toLowerCase()}|${fact.period.toLowerCase()}`;if(knownFacts.has(key)){skippedDuplicates++;continue;}knownFacts.add(key);facts.push(fact);}
    if(facts.length){w.careerSources.unshift(source);w.careerFacts.unshift(...facts);}
    saveDb();return ok(res,{workspace:w,imported:{profileFields,profileItems,facts:facts.length,skippedDuplicates}});
  }
  if(method==='POST'&&route==='/api/v1/workspace/reset'){removeUserUploads(user.id);user.workspace=defaultWorkspace(user.name,user.email);saveDb();return ok(res,user.workspace);}
  if(method==='DELETE'&&route==='/api/v1/account'){
    removeUserUploads(user.id);
    for(const [id,session] of Object.entries(db.sessions))if(session.userId===user.id)delete db.sessions[id];
    delete db.users[user.id];saveDb();res.writeHead(204,{'Set-Cookie':sessionCookie('',0)});return res.end();
  }
  if(method==='PUT'&&route==='/api/v1/profile'){w.profile={...w.profile,...payload};saveDb();return ok(res,w.profile);}
  if(method==='POST'&&route==='/api/v1/career-stories'){const item={...payload,id:uid(),createdAt:now()};w.stories.unshift(item);saveDb();return ok(res,item,201);}
  if(method==='POST'&&route==='/api/v1/career-sources'){
    if(!payload.name)return fail(res,400,'원본 이름을 입력하세요.','INVALID_SOURCE');
    if(payload.attachmentId&&!(w.attachments||[]).some(x=>x.id===payload.attachmentId))return fail(res,404,'연결할 파일을 찾을 수 없습니다.','NOT_FOUND');
    const item={id:uid(),name:String(payload.name).slice(0,200),type:['resume','portfolio','career-note'].includes(payload.type)?payload.type:'resume',attachmentId:payload.attachmentId||undefined,rawText:String(payload.rawText||'').slice(0,150000)||undefined,status:'ready',createdAt:now()};
    w.careerSources.unshift(item);saveDb();return ok(res,item,201);
  }
  let sourceMatch=route.match(/^\/api\/v1\/career-sources\/([^/]+)(?:\/(extract))?$/);
  if(sourceMatch&&method==='POST'&&sourceMatch[2]==='extract'){
    const source=w.careerSources.find(x=>x.id===sourceMatch[1]);if(!source)return fail(res,404,'원본을 찾을 수 없습니다.','NOT_FOUND');
    const facts=await extractCareerFacts(user,source);
    w.careerFacts=w.careerFacts.filter(f=>f.status==='verified'||!f.sourceIds.includes(source.id));
    w.careerFacts.unshift(...facts);source.status=facts.length?'review':'needs-text';source.extractedAt=now();saveDb();return ok(res,{source,facts});
  }
  if(sourceMatch&&method==='DELETE'&&!sourceMatch[2]){
    const index=w.careerSources.findIndex(x=>x.id===sourceMatch[1]);if(index<0)return fail(res,404,'원본을 찾을 수 없습니다.','NOT_FOUND');
    const [source]=w.careerSources.splice(index,1);w.careerFacts=w.careerFacts.filter(f=>!f.sourceIds.includes(source.id));
    if(source.attachmentId){const fileIndex=(w.attachments||[]).findIndex(x=>x.id===source.attachmentId);if(fileIndex>=0){const [file]=w.attachments.splice(fileIndex,1);const filePath=path.join(DATA_DIR,'uploads',user.id,file.storageName);if(fs.existsSync(filePath))fs.unlinkSync(filePath);}}
    saveDb();res.writeHead(204);return res.end();
  }
  if(method==='POST'&&route==='/api/v1/career-facts'){
    const item=normalizeExtractedFact(payload,'');item.sourceIds=Array.isArray(payload.sourceIds)?payload.sourceIds.filter(id=>w.careerSources.some(source=>source.id===id)):[];item.status=['review','verified','excluded'].includes(payload.status)?payload.status:'review';item.sensitive=Boolean(payload.sensitive);w.careerFacts.unshift(item);saveDb();return ok(res,item,201);
  }
  let factMatch=route.match(/^\/api\/v1\/career-facts\/([^/]+)$/);
  if(factMatch&&method==='PATCH'){
    const item=w.careerFacts.find(x=>x.id===factMatch[1]);if(!item)return fail(res,404,'커리어 정보를 찾을 수 없습니다.','NOT_FOUND');
    if(payload.category!==undefined&&careerCategories.has(payload.category))item.category=payload.category;
    for(const key of ['title','organization','period','description','achievements'])if(payload[key]!==undefined)item[key]=String(payload[key]).slice(0,key==='description'?10000:5000);
    if(payload.skills!==undefined)item.skills=(Array.isArray(payload.skills)?payload.skills:[]).map(String).map(x=>x.trim()).filter(Boolean).slice(0,30);
    if(payload.sourceIds!==undefined)item.sourceIds=(Array.isArray(payload.sourceIds)?payload.sourceIds:[]).filter(id=>w.careerSources.some(source=>source.id===id));
    if(payload.status!==undefined&&['review','verified','excluded'].includes(payload.status))item.status=payload.status;
    if(payload.sensitive!==undefined)item.sensitive=Boolean(payload.sensitive);
    item.updatedAt=now();saveDb();return ok(res,item);
  }
  if(factMatch&&method==='DELETE'){const before=w.careerFacts.length;w.careerFacts=w.careerFacts.filter(x=>x.id!==factMatch[1]);if(before===w.careerFacts.length)return fail(res,404,'커리어 정보를 찾을 수 없습니다.','NOT_FOUND');saveDb();res.writeHead(204);return res.end();}
  const normalizeConsultation=(raw,id)=>({id:id||uid(),type:['career-coaching','company','mentoring','mock-interview','qna','other'].includes(raw?.type)?raw.type:'other',title:String(raw?.title||'').trim().slice(0,300),organization:String(raw?.organization||'').trim().slice(0,300),consultant:String(raw?.consultant||'').trim().slice(0,200),date:String(raw?.date||'').trim().slice(0,50),relatedCompany:String(raw?.relatedCompany||'').trim().slice(0,300),relatedRole:String(raw?.relatedRole||'').trim().slice(0,300),summary:String(raw?.summary||'').slice(0,20000),transcript:String(raw?.transcript||'').slice(0,150000),qna:(Array.isArray(raw?.qna)?raw.qna:[]).map(item=>({question:String(item?.question||'').slice(0,5000),answer:String(item?.answer||'').slice(0,20000),topic:String(item?.topic||'').slice(0,200)})).filter(item=>item.question||item.answer).slice(0,200),insights:(Array.isArray(raw?.insights)?raw.insights:[]).map(String).map(x=>x.trim()).filter(Boolean).slice(0,100),actionItems:(Array.isArray(raw?.actionItems)?raw.actionItems:[]).map(String).map(x=>x.trim()).filter(Boolean).slice(0,100),tags:(Array.isArray(raw?.tags)?raw.tags:[]).map(String).map(x=>x.trim()).filter(Boolean).slice(0,50),attachmentIds:(Array.isArray(raw?.attachmentIds)?raw.attachmentIds:[]).filter(id=>w.attachments.some(file=>file.id===id)),createdAt:raw?.createdAt||now(),updatedAt:now()});
  if(method==='POST'&&route==='/api/v1/consultations'){if(!payload.title)return fail(res,400,'상담 제목을 입력해 주세요.','INVALID_CONSULTATION');const item=normalizeConsultation(payload);w.consultations.unshift(item);saveDb();return ok(res,item,201);}
  let consultationMatch=route.match(/^\/api\/v1\/consultations\/([^/]+)$/);
  if(consultationMatch&&method==='PUT'){const index=w.consultations.findIndex(x=>x.id===consultationMatch[1]);if(index<0)return fail(res,404,'상담 기록을 찾을 수 없습니다.','NOT_FOUND');w.consultations[index]=normalizeConsultation({...w.consultations[index],...payload},consultationMatch[1]);saveDb();return ok(res,w.consultations[index]);}
  if(consultationMatch&&method==='DELETE'){const before=w.consultations.length;w.consultations=w.consultations.filter(x=>x.id!==consultationMatch[1]);if(before===w.consultations.length)return fail(res,404,'상담 기록을 찾을 수 없습니다.','NOT_FOUND');saveDb();res.writeHead(204);return res.end();}
  if(method==='POST'&&route==='/api/v1/jobs'){const item={...payload,id:uid(),createdAt:now()};w.jobs.unshift(item);saveDb();return ok(res,item,201);}
  const jobMatch=route.match(/^\/api\/v1\/jobs\/([^/]+)$/);
  if(jobMatch&&method==='PATCH'){const item=w.jobs.find(x=>x.id===jobMatch[1]);if(!item)return fail(res,404,'공고를 찾을 수 없습니다.','NOT_FOUND');for(const key of ['company','role','deadline','url','description','skills','companyAnalysis','pageContent','coverImage','pages'])if(payload[key]!==undefined)item[key]=payload[key];item.updatedAt=now();saveDb();return ok(res,item);}
  if(method==='POST'&&route==='/api/v1/applications'){let job=w.jobs.find(j=>j.id===payload.jobId);if(!job){job={id:uid(),company:payload.company,role:payload.role,deadline:payload.deadline||'',url:payload.url||'',description:'',skills:[]};w.jobs.unshift(job)}const item={id:uid(),jobId:job.id,status:payload.status||'관심',appliedAt:payload.appliedAt||'',nextProcess:payload.nextProcess||payload.next||'',nextDate:payload.nextDate||'',processSteps:Array.isArray(payload.processSteps)?payload.processSteps:[],next:payload.nextProcess||payload.next||'',memo:payload.memo||'',createdAt:now()};w.applications.unshift(item);saveDb();return ok(res,item,201);}
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
  if(method==='POST'&&route==='/api/v1/ai/jobs/analyze'){let result;try{result=await aiJson('채용 공고를 분석해 JSON만 출력하세요. 키: skills, responsibilities, requirements, preferredQualifications. 모든 값은 문자열 배열이며 원문에 없는 사실을 만들지 마세요.',payload.description||'')}catch(e){console.error(e);result=null}return ok(res,result||localAnalyze(payload.description));}
  if(method==='POST'&&route==='/api/v1/ai/documents/generate'){const job=w.jobs.find(j=>j.id===payload.jobId);if(!job)return fail(res,404,'공고를 찾을 수 없습니다.','NOT_FOUND');const selected=w.stories.filter(s=>(payload.careerStoryIds||[]).includes(s.id));let result;try{result=await aiJson('사용자가 제공한 사실만 사용해 한국어 자기소개서 초안을 작성하고 JSON만 출력하세요. 키: title, content, citations, warnings. 근거 없는 성과나 수치를 만들지 마세요.',JSON.stringify({job,profile:w.profile,careerStories:selected}))}catch(e){console.error(e);result=null}const item={...(result||localDocument(w,job)),id:uid(),jobId:job.id,createdAt:now(),updatedAt:now()};w.docs.unshift(item);saveDb();return ok(res,item,201);}
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
