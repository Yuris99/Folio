import { useMemo, useState, type ChangeEvent } from 'react';
import { api } from '../api';
import { importPrompts, parseImport, type ImportKind } from '../components/CareerImportModal';
import { PageHead } from '../components/Common';
import type { Mutation } from '../hooks/useFolio';
import type { ConsultationRecord } from '../types';
import { consultationImportPrompt } from './ConsultationsPage';

type PageKind = ImportKind | 'consultations';
const configs: Record<PageKind,{label:string;description:string;icon:string;prompt:string;destination:string}> = {
  career:{...importPrompts.career,icon:'◇',destination:'커리어'}, applications:{...importPrompts.applications,icon:'▦',destination:'지원 관리'}, 'company-analysis':{...importPrompts['company-analysis'],icon:'◎',destination:'공고·기업 상세'}, interviews:{...importPrompts.interviews,icon:'◉',destination:'면접'}, documents:{...importPrompts.documents,icon:'▤',destination:'지원 문서'}, tasks:{...importPrompts.tasks,icon:'◫',destination:'홈·일정'},
  consultations:{label:'상담·Q&A',description:'컨설팅, 현업 상담, 멘토링, 녹취와 질문답변',icon:'≡',prompt:consultationImportPrompt,destination:'상담·Q&A'}
};
const emptyConsultation: Omit<ConsultationRecord,'id'> = {type:'other',title:'',organization:'',consultant:'',date:'',relatedCompany:'',relatedRole:'',summary:'',transcript:'',qna:[],insights:[],actionItems:[],tags:[],attachmentIds:[]};

export function ImportsPage({ mutate }: { mutate: Mutation }) {
  const [kind,setKind]=useState<PageKind>('career'); const [text,setText]=useState(''); const [notice,setNotice]=useState('');
  const validation=useMemo(()=>{if(!text.trim())return{value:null,error:'',count:0};try{if(kind==='consultations'){const value=JSON.parse(text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));if(value.format!=='folio-consultation-import'||value.version!==1||!Array.isArray(value.records))throw new Error('상담·Q&A용 JSON 형식이 아닙니다.');return{value,error:'',count:value.records.length};}const value=parseImport(text,kind);const count=value.format==='folio-chat-import'?Object.values(value.data).reduce((sum,list)=>sum+list.length,0):Object.entries(value).reduce((sum,[key,item])=>sum+(!['format','version'].includes(key)&&Array.isArray(item)?item.length:0),0);return{value,error:'',count};}catch(error){return{value:null,error:error instanceof Error?error.message:'JSON 형식을 확인해 주세요.',count:0};}},[text,kind]);
  function select(next:PageKind){setKind(next);setText('');setNotice('');}
  async function copy(){await navigator.clipboard.writeText(configs[kind].prompt);setNotice('프롬프트를 복사했습니다. 기존 AI 채팅에 붙여넣으세요.');}
  function file(event:ChangeEvent<HTMLInputElement>){const selected=event.target.files?.[0];if(!selected)return;const reader=new FileReader();reader.onload=()=>setText(String(reader.result||''));reader.readAsText(selected);}
  async function submit(){if(!validation.value)return;if(kind==='consultations'){const records=(validation.value as {records:Partial<ConsultationRecord>[]}).records;await mutate('상담·Q&A 가져오기',()=>Promise.all(records.map(item=>api.createConsultation({...emptyConsultation,...item,attachmentIds:[]}))));}else if(validation.value.format==='folio-career-import')await mutate('커리어 가져오기',()=>api.importCareerData(validation.value));else await mutate(`${configs[kind].label} 가져오기`,()=>api.importChatData(validation.value));setText('');setNotice(`${validation.count}개 항목을 ${configs[kind].destination}에 저장했습니다.`);}
  return <>
    <PageHead kicker="AI CHAT IMPORT" title="AI 채팅에서 가져오기" description="기존 채팅의 내용을 Folio 형식으로 정리해 한 번에 저장합니다. Folio의 AI 토큰은 사용하지 않습니다." />
    <section className="import-page">
      <div className="import-page-step"><span>1</span><div><h2>가져올 데이터 선택</h2><p>채팅의 주제에 맞는 형식을 선택하세요. 종류가 섞여 있다면 각각 한 번씩 가져오는 것이 정확합니다.</p></div></div>
      <div className="import-big-grid">{(Object.keys(configs) as PageKind[]).map(item=><button key={item} className={kind===item?'active':''} onClick={()=>select(item)}><i>{configs[item].icon}</i><span><b>{configs[item].label}</b><small>{configs[item].description}</small><em>저장 위치 · {configs[item].destination}</em></span></button>)}</div>
      <div className="import-page-columns">
        <section className="import-large-card"><div className="import-page-step"><span>2</span><div><h2>기존 채팅에 프롬프트 입력</h2><p>{configs[kind].label} 전용 포맷으로 정리하도록 요청합니다.</p></div></div><pre>{configs[kind].prompt}</pre><button className="button primary large" onClick={()=>void copy()}>프롬프트 전체 복사</button></section>
        <section className="import-large-card"><div className="import-page-step"><span>3</span><div><h2>AI가 만든 JSON 붙여넣기</h2><p>답변 전체를 복사하세요. 코드 블록이 포함되어도 처리합니다.</p></div></div><textarea rows={18} value={text} onChange={event=>setText(event.target.value)} placeholder="여기에 JSON을 붙여넣으세요"/><div className="import-submit-row"><label className="button file-button">JSON 파일 선택<input hidden type="file" accept="application/json,.json" onChange={file}/></label><button className="button primary large" disabled={!validation.value} onClick={()=>void submit()}>Folio에 가져오기</button></div>{validation.error&&<p className="import-error">{validation.error}</p>}{validation.value&&<div className="import-ready"><b>{validation.count}개 항목 확인됨</b><span>{configs[kind].destination}에 저장할 준비가 됐습니다.</span></div>}</section>
      </div>{notice&&<div className="import-page-notice">✓ {notice}</div>}
    </section>
  </>;
}
