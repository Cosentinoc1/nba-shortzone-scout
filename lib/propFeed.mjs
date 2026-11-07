/** Optional licensed third-party line provider, or user-published Google Sheet CSV.
 * No direct access to PrizePicks private endpoints and no secret is sent to browsers.
 */
import {parseCsv,normalizeRows,freshness} from './props.mjs';
const MAX_BODY=3*1024*1024,COOLDOWN=12*3600*1000;
let last={at:0,source:null,rows:[],error:null},pending=null;
async function fetchText(url,headers={}){
 const ac=new AbortController(),timeout=setTimeout(()=>ac.abort(),14000);
 try{const r=await fetch(url,{headers,signal:ac.signal});if(!r.ok)throw Error(`Data provider returned HTTP ${r.status}`);
   const len=Number(r.headers.get('content-length')||0);if(len>MAX_BODY)throw Error('Prop feed exceeds allowed size');
   const t=await r.text();if(t.length>MAX_BODY)throw Error('Prop feed exceeds allowed size');return t;
 }finally{clearTimeout(timeout)}
}
async function fromProvider(key){
 const base='https://prizepicksapi.com/api/v1/projections';let rows=[],cursor=null;
 for(let page=0;page<4;page++){
  const u=new URL(base);for(const [k,v] of Object.entries({league:'NBA',tier:'standard',status:'active',view:'compact',limit:'1000'}))u.searchParams.set(k,v);
  if(cursor)u.searchParams.set('cursor',cursor);
  const t=await fetchText(u.href,{'Accept':'application/json','Authorization':`Bearer ${key}`,'X-User-Request':'Read current NBA standard lines for a user-owned research dashboard'});
  let b;try{b=JSON.parse(t)}catch{throw Error('Provider response was not valid JSON')}
  if(!Array.isArray(b.data))throw Error(String(b.error?.message||'Provider did not return projection rows'));
  rows.push(...b.data);cursor=b.meta?.next_cursor||null;if(!cursor)break;
 }
 return normalizeRows(rows);
}
async function fromCsv(url){
 const u=new URL(url);if(u.protocol!=='https:'||!['docs.google.com','script.google.com'].includes(u.hostname))throw Error('PROPS_CSV_URL must be a published Google Sheets/Apps Script HTTPS link');
 return normalizeRows(parseCsv(await fetchText(url)));
}
export async function loadPropsFeed(){
 const key=process.env.PRIZEPICKS_API_KEY?.trim(),sheet=process.env.PROPS_CSV_URL?.trim();
 const configured=Boolean(key||sheet);const source=key?'Independent PrizePicks data provider':sheet?'Published Google Sheet CSV':'Not configured';
 if(!configured)return {configured:false,source,rows:[],fetchedAt:null,status:'not-configured',error:null,notice:'Set PRIZEPICKS_API_KEY (independent third-party feed) or PROPS_CSV_URL (published Google Sheet) in Render Environment; or import CSV in the page.'};
 if(last.at&&Date.now()-last.at<COOLDOWN&&last.source===source)return {configured:true,source,rows:last.rows,fetchedAt:new Date(last.at).toISOString(),status:last.error?'error':'ok',freshness:freshness(last.rows),error:last.error};
 if(pending)return pending;
 pending=(async()=>{
  try{const rows=key?await fromProvider(key):await fromCsv(sheet);last={at:Date.now(),source,rows,error:null};
    return {configured:true,source,rows,fetchedAt:new Date(last.at).toISOString(),status:'ok',freshness:freshness(rows),error:null};
  }catch(e){last={...last,at:Date.now(),source,error:e.message};
    return {configured:true,source,rows:[],fetchedAt:new Date(last.at).toISOString(),status:'error',freshness:freshness([]),error:e.message};
  }finally{pending=null}
 })();return pending;
}
export function feedStatusOnly(feed){const {rows,...other}=feed;return {...other,count:rows.length}}
