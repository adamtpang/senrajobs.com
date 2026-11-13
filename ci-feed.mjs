// CI Financial's own public Workday board. Kurt MacAlpine leads CI and founded Corient, and the two
// boards live on the same Workday tenant. A requisition cross-posted to both belongs to Corient here,
// so any CI row whose requisition ID also appears on the Corient board is excluded.
import {fetchWorkday} from './workday-feed.mjs';
export const CI_SOURCE={kind:'workday',slug:'ci|wd3|CI_FINANCIAL_EXTERNAL_CAREER-SITE'};
export const CORIENT_SOURCE={kind:'workday',slug:'ci|wd3|CORIENT_EXTERNAL_CAREER-SITE'};
export function excludeCrossPosts(ciRows,corientRows){
 const corient=new Set(corientRows.map(row=>String(row.id||'')).filter(Boolean));
 const rows=[],excluded=[];
 for(const row of ciRows)(row.id&&corient.has(String(row.id))?excluded:rows).push(row);
 return {rows,excluded};
}
export async function fetchCiFinancial({request,mapJob,maxPages=500,observedAt,fetchBoard=fetchWorkday}){
 const ci=await fetchBoard(CI_SOURCE,{request,mapJob,maxPages,observedAt});
 if(ci.status==='failed')return ci;
 const corient=await fetchBoard(CORIENT_SOURCE,{request,mapJob,maxPages,observedAt});
 // Without a complete Corient listing the cross-post rule cannot be applied, so keep the previous catalog.
 if(corient.status!=='complete')return {rows:[],status:'failed',observedAt,endpoint:ci.endpoint,pages:ci.pages,total:ci.total,reason:`Corient board ${corient.status}; cross-post exclusion could not be verified, so the CI board was not replaced`};
 const {rows,excluded}=excludeCrossPosts(ci.rows,corient.rows);
 return {...ci,rows,excluded:excluded.map(row=>({url:row.url,id:row.id,reason:'Requisition also posted on the Corient board'})),reason:`${ci.reason?ci.reason+' ':''}${excluded.length} requisition${excluded.length===1?'':'s'} cross-posted on the Corient board excluded; ${rows.length} CI roles kept.`.trim()};
}
