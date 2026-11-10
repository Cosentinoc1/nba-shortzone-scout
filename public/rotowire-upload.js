/* NBA Scout · XLSX/CSV daily RotoWire importer. Parsing & session persistence happen
 * in the user's browser; the compact rows are POSTed for a transient analysis only.
 */
import {findClientProjection,safeProjectionStat} from './roto-name-v318.mjs';
const FILE_KEY='nbaScoutRotowireV19';
const COLS=['NAME','Team','OPP','Pos','MIN','PTS','REB','AST','STL','BLK','TO','FGM','FGA','FG%','3PM','3PA','3P%','FTM','FTA','FT%','OREB','DREB'];
const XML_NS='http://www.w3.org/2000/xmlns/';
const bytesToText = data => new TextDecoder('utf-8').decode(data);
const bufferDV = (buf)=>new DataView(buf.buffer,buf.byteOffset,buf.byteLength);
function utf8(bytes){return bytesToText(bytes)}
function parseXml(text){const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.querySelector('parsererror'))throw Error('The Excel XML is damaged');return doc}
function selectAll(node,name){return Array.from(node.getElementsByTagName(name))}
function first(node,name){return node.getElementsByTagName(name)[0]||null}
function readZipDirectory(bytes){
 const dv=bufferDV(bytes),size=bytes.byteLength;
 let eocd=-1;for(let i=size-22;i>=Math.max(0,size-66000);i--)if(dv.getUint32(i,true)===0x06054b50){eocd=i;break}
 if(eocd<0)throw Error('Not a valid .xlsx ZIP file');
 const count=dv.getUint16(eocd+10,true),start=dv.getUint32(eocd+16,true);
 if(count>1500||start>=size)throw Error('Excel workbook has too many entries');
 let p=start;const map=new Map();
 for(let i=0;i<count;i++){
  if(dv.getUint32(p,true)!==0x02014b50)throw Error('Broken ZIP central directory');
  const method=dv.getUint16(p+10,true),compressed=dv.getUint32(p+20,true),uncompressed=dv.getUint32(p+24,true),nameLen=dv.getUint16(p+28,true),extLen=dv.getUint16(p+30,true),commentLen=dv.getUint16(p+32,true),offset=dv.getUint32(p+42,true);
  if(nameLen>1024||uncompressed>8000000)throw Error('Oversize Excel XML entry');
  const name=utf8(bytes.subarray(p+46,p+46+nameLen));
  map.set(name,{method,compressed,uncompressed,offset});p+=46+nameLen+extLen+commentLen;
 }
 return map;
}
async function zipPart(bytes,table,path){
 const item=table.get(path);if(!item)throw Error('Excel is missing '+path);
 const v=bufferDV(bytes),p=item.offset;
 if(v.getUint32(p,true)!==0x04034b50)throw Error('Invalid ZIP entry');
 const offset=p+30+v.getUint16(p+26,true)+v.getUint16(p+28,true);
 const end=offset+item.compressed;
 if(end>bytes.length)throw Error('Truncated ZIP content');
 const body=bytes.subarray(offset,end);
 if(item.method===0)return utf8(body);
 if(item.method!==8)throw Error('Unsupported Excel compression');
 if(typeof DecompressionStream==='undefined')throw Error('This browser cannot decompress XLSX. Save as CSV or open in current Chrome.');
 const decompressed=new Blob([body]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
 const full=new Uint8Array(await new Response(decompressed).arrayBuffer());
 if(full.length>8000000)throw Error('Excel sheet is too large');return utf8(full);
}
const colNumber = cell => {const m=String(cell||'').match(/^([A-Z]+)/i);if(!m)return null;let n=0;for(const c of m[1].toUpperCase())n=n*26+c.charCodeAt(0)-64;return n-1;};
async function parseXlsx(buffer){
 const bytes=new Uint8Array(buffer);if(bytes.length>2000000)throw Error('RotoWire XLSX exceeds the 2 MB limit');
 const entries=readZipDirectory(bytes);
 let strings=[];
 if(entries.has('xl/sharedStrings.xml')){const raw=parseXml(await zipPart(bytes,entries,'xl/sharedStrings.xml'));strings=selectAll(raw,'si').map(si=>selectAll(si,'t').map(n=>n.textContent).join(''));}
 let sheetName=entries.has('xl/worksheets/sheet1.xml')?'xl/worksheets/sheet1.xml':null;
 if(!sheetName)sheetName=[...entries.keys()].find(x=>/^xl\/worksheets\/sheet\d+\.xml$/.test(x));
 if(!sheetName)throw Error('No worksheet found in Excel');
 const xml=parseXml(await zipPart(bytes,entries,sheetName));
 const rows=[];
 for(const row of selectAll(xml,'row')){
  if(rows.length>520)break;
  const data=[];
  for(const cell of selectAll(row,'c')){
   const idx=colNumber(cell.getAttribute('r'));if(idx===null||idx>30)continue;
   const t=cell.getAttribute('t'),v=first(cell,'v');
   let value=t==='inlineStr'?first(cell,'is')?.textContent??'':v?.textContent??'';
   if(t==='s')value=strings[Number(value)]??'';
   else if(t==='n'||(!t&&/^-?\d+(?:\.\d+)?$/.test(value)))value=Number(value);
   data[idx]=value;
  }
  if(data.some(x=>x!==undefined&&x!==''))rows.push(data);
 }
 return rows;
}
function parseCsv(text){
 const rows=[];let value='',row=[],quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){value+='"';i++}else if(c==='"')quoted=false;else value+=c;continue;}
  if(c==='"')quoted=true;else if(c===','){row.push(value);value=''}else if(c==='\n'){row.push(value.replace(/\r$/,''));if(row.some(x=>String(x).trim()))rows.push(row);row=[];value='';}else value+=c;
 }
 row.push(value.replace(/\r$/,''));if(row.some(x=>String(x).trim()))rows.push(row);if(quoted)throw Error('Unfinished quote in CSV');return rows;
}
function toProjectionRows(table){
 const headIdx=table.findIndex(r=>String(r?.[0]||'').trim().toUpperCase()==='NAME'&&String(r?.[1]||'').trim().toLowerCase()==='team');
 if(headIdx<0)throw Error('Expected RotoWire NAME / Team / OPP / Pos / MIN headers');
 const headers=table[headIdx].map(x=>String(x||'').trim());
 if(!['MIN','PTS','REB','AST','FGA','3PA'].every(k=>headers.includes(k)))throw Error('This export is missing MIN, PTS, REB, AST, FGA or 3PA');
 const output=[];
 for(const row of table.slice(headIdx+1,headIdx+501)){
  const item=Object.fromEntries(headers.map((h,i)=>[h,row[i]??'']));
  if(!String(item.NAME||'').trim()||!String(item.Team||'').trim())continue;
  const projected={};for(const k of COLS)if(k in item)projected[k]=item[k];
  output.push(projected);
 }
 if(!output.length)throw Error('RotoWire export contains no player rows');return output;
}
function loadedPack(){try{const v=JSON.parse(localStorage.getItem(FILE_KEY)||'null');return v?.rows?.length&&v.date&&v.uploadedAt?v:null}catch{return null}}
function savePack(pack){try{localStorage.setItem(FILE_KEY,JSON.stringify(pack));return true}catch{return false}}
function clearPack(){try{localStorage.removeItem(FILE_KEY)}catch{}}
function dateNow(){return document.getElementById('dateInput')?.value||''}
function status(message,kind='neutral'){const el=document.getElementById('rtoStatus');if(el){el.hidden=false;el.dataset.kind=kind;el.textContent=message}}
function activeForDate(){const pack=loadedPack();return pack?.date===dateNow()?pack:null}
function rosterMatch(team,name){return `${String(team||'').toUpperCase()}:${String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase()}`}
function getProjection(team,name){const pack=activeForDate();return pack?findClientProjection(pack.rows,team,name):null}
const projectionStat=(p,stat)=>safeProjectionStat(p,stat);
window.NBAScoutRoto={getProjection,activeForDate,projectionStat};
window.addEventListener('scout-board-loaded',()=>{
 const pack=activeForDate();if(pack){status(`RotoWire ${pack.rows.length} player projections loaded for ${pack.date} · ${new Date(pack.uploadedAt).toLocaleTimeString()} · this browser only`,'ok');window.dispatchEvent(new CustomEvent('scout-rotowire-data',{detail:pack}));}
 else {const stale=loadedPack();status(stale?`Previous RotoWire file is for ${stale.date}; upload today's projections`:'Upload your RotoWire spreadsheet to add projected minutes and stat forecasts','neutral');}
});
const input=document.getElementById('rtoInput');
if(input)input.addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;input.value='';
 status(`Reading ${file.name}…`);
 try{
  if(file.size>2000000)throw Error('RotoWire file must be smaller than 2 MB');
  const rows=/\.xlsx$/i.test(file.name)?await parseXlsx(await file.arrayBuffer()):parseCsv(await file.text());
  const data=toProjectionRows(rows),date=dateNow();if(!/^20\d{2}-\d{2}-\d{2}$/.test(date))throw Error('Select the NBA game day before importing');
  const pack={date,rows:data,uploadedAt:new Date().toISOString(),filename:file.name};
  if(!savePack(pack))status('Browser storage disabled: import is available in this open tab only','warning');
  status(`${data.length} RotoWire rows imported for ${date}. Matching today’s NBA props…`,'ok');
  window.dispatchEvent(new CustomEvent('scout-rotowire-data',{detail:pack}));
 }catch(err){status('RotoWire import failed: '+err.message,'error')}
});
const clear=document.getElementById('rtoClear');if(clear)clear.onclick=()=>{clearPack();status('RotoWire forecast cleared from this browser. Showing historical-only research.');window.dispatchEvent(new CustomEvent('scout-rotowire-clear'))};
export {parseXlsx,toProjectionRows,parseCsv};
