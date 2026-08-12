const fs = require('fs');
const path = require('path');

const ROOT=__dirname;
const production=process.argv.includes('--production');

function readEnv(){
  const values={...process.env},file=path.join(ROOT,'.env');
  if(!fs.existsSync(file))return {values,fileExists:false};
  for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
    const match=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if(!match||values[match[1]]!==undefined)continue;
    let value=match[2];
    if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
    values[match[1]]=value;
  }
  return {values,fileExists:true};
}

const {values:env,fileExists}=readEnv();
const errors=[],warnings=[],checks=[];
const mark=(label,ok,detail='')=>checks.push({label,ok,detail});
const has=name=>typeof env[name]==='string'&&env[name].trim().length>0;

const nodeMajor=Number(process.versions.node.split('.')[0]);
mark('Node.js 18 이상',nodeMajor>=18,process.version);
if(nodeMajor<18)errors.push('Node.js 18 이상이 필요합니다.');

mark('.env 파일',fileExists,fileExists?'발견':'없음');
if(!fileExists)errors.push('.env.example을 복사해 .env를 만드세요.');

const ignored=fs.existsSync(path.join(ROOT,'.gitignore'))&&fs.readFileSync(path.join(ROOT,'.gitignore'),'utf8').split(/\r?\n/).some(line=>line.trim()==='.env');
mark('.env Git 제외',ignored,ignored?'안전':'규칙 없음');
if(!ignored)errors.push('.gitignore에 .env 규칙이 필요합니다.');

for(const name of ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REDIRECT_URI']){
  mark(name,has(name),has(name)?'설정됨':'미설정');
  if(production&&!has(name))errors.push(`${name}을 설정하세요.`);
  else if(!production&&!has(name))warnings.push(`${name} 미설정: 개발용 로그인으로 동작합니다.`);
}

const aiProvider=(env.AI_PROVIDER||'openai').toLowerCase();
const aiKey=aiProvider==='gemini'?'GEMINI_API_KEY':'OPENAI_API_KEY';
mark('AI 공급자',true,aiProvider);
mark(aiKey,has(aiKey),has(aiKey)?'설정됨':'미설정');
if(production&&!has(aiKey))errors.push(`${aiKey}를 설정하세요.`);
else if(!production&&!has(aiKey))warnings.push(`${aiKey} 미설정: 텍스트 보존 대체 경로로 동작합니다.`);

if(production){
  if(env.NODE_ENV!=='production')errors.push('NODE_ENV를 production으로 설정하세요.');
  for(const name of ['APP_ORIGIN','GOOGLE_REDIRECT_URI']){
    try{const value=new URL(env[name]);mark(`${name} HTTPS`,value.protocol==='https:',value.origin);if(value.protocol!=='https:')errors.push(`${name}은 HTTPS 주소여야 합니다.`)}
    catch{mark(`${name} HTTPS`,false,'유효하지 않은 URL');errors.push(`${name}에 유효한 URL을 설정하세요.`)}
  }
  if(has('APP_ORIGIN')&&has('GOOGLE_REDIRECT_URI')){
    try{if(new URL(env.APP_ORIGIN).origin!==new URL(env.GOOGLE_REDIRECT_URI).origin)errors.push('APP_ORIGIN과 GOOGLE_REDIRECT_URI의 origin이 일치해야 합니다.')}catch{}
  }
}

console.log(`Folio ${production?'운영':'로컬'} 배포 사전 점검`);
for(const check of checks)console.log(`${check.ok?'PASS':'WAIT'}  ${check.label}${check.detail?` — ${check.detail}`:''}`);
for(const warning of [...new Set(warnings)])console.log(`WARN  ${warning}`);
for(const error of [...new Set(errors)])console.log(`ERROR ${error}`);
console.log(errors.length?'\n준비가 필요한 항목이 있습니다.':'\n사전 점검을 통과했습니다.');
process.exitCode=errors.length?1:0;
