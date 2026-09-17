/* Fly.ai-inspired full MaleCNS browser worker.
   Loads the web export from alextitonis/fly.ai (166,700 neurons / ~25.1M edges),
   then runs the same basic LIF recipe: v <- decay*v + gain*W*spikes + tonic + input.
   The game-facing aliases map real fly cell types/classes to sensory and motor controls.
*/
const ROOT='https://raw.githubusercontent.com/alextitonis/fly.ai/main/world/public/connectome/';
const BRAIN_URL=ROOT+'brain.json',META_URL=ROOT+'meta.bin';
const DT=.020,TAU=.100,DECAY=Math.exp(-DT/TAU),GAIN=3.0,TONIC=.14,THRESHOLD=1,MAX_SAMPLE=1800,TICK_MS=80;
let N=0,E=0,lnMin=0,indptr,targets,qcodes,V,fired,types=[],classes=[],typeIdx,classIdx,side;
let aliasSamples={},running=false,stimuli={},tickNo=0;
const ALIASES=['VIS_ME','VIS_LPTC','VIS_LO','OLF_ORN_FOOD','MECH_BRISTLE','MECH_JO','CX_PFN','CX_FC','CX_HDELTA','GNG_DESC','VNC_CPG'];

async function gunzip(buf){
  if(typeof DecompressionStream==='undefined')throw Error('This browser has no DecompressionStream support');
  const ds=new DecompressionStream('gzip'),w=ds.writable.getWriter();await w.write(new Uint8Array(buf));await w.close();
  const r=ds.readable.getReader(),chunks=[];let total=0;for(;;){const x=await r.read();if(x.done)break;chunks.push(x.value);total+=x.value.byteLength}
  const out=new Uint8Array(total);let p=0;for(const c of chunks){out.set(c,p);p+=c.byteLength}return out.buffer;
}
async function getJson(url){const r=await fetch(url,{cache:'force-cache'});if(!r.ok)throw Error('Fetch failed: HTTP '+r.status);return r.json()}
async function getBinary(url){const r=await fetch(url,{cache:'force-cache'});if(!r.ok)throw Error('Fetch failed: HTTP '+r.status);return r.arrayBuffer()}
function readVarints(bytes,pos,count){const out=new Uint32Array(count);let p=pos;for(let i=0;i<count;i++){let v=0,s=0,b;do{b=bytes[p++];v|=(b&127)<<s;s+=7}while(b&128);out[i]=v>>>0}return [out,p]}
function parseMeta(buf){
  const d=new DataView(buf);if(d.getUint32(0,false)!==0x464c594d)throw Error('Invalid fly.ai meta header');
  const n=d.getUint32(8,true),len=d.getUint32(12,true);const header=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,16,len)));let p=16+len;
  const ti=new Uint16Array(buf.slice(p,p+n*2));p+=n*2;const ci=new Uint8Array(buf.slice(p,p+n));p+=n;const si=new Uint8Array(buf.slice(p,p+n));
  types=header.types;classes=header.superclasses;typeIdx=ti;classIdx=ci;side=si;
}
function decodeWeights(buf){
  const d=new DataView(buf);if(d.getUint32(0,false)!==0x464c5957)throw Error('Invalid fly.ai weight header');
  const version=d.getUint32(4,true);if(version!==1)throw Error('Unsupported fly.ai weight version '+version);N=d.getUint32(8,true);E=d.getUint32(12,true);lnMin=d.getFloat32(16,true);let p=20;
  [indptr,p]=readVarints(new Uint8Array(buf),p,N);const degrees=indptr;let acc=0;for(let i=0;i<N;i++){const x=degrees[i];degrees[i]=acc;acc+=x}degrees[N]=acc;indptr=degrees;
  [targets,p]=readVarints(new Uint8Array(buf),p,E);let cursor=0;for(let i=0;i<N;i++){const start=indptr[i],end=indptr[i+1];for(let e=start;e<end;e++){const gap=targets[e];cursor=e===start?gap:cursor+gap;targets[e]=cursor}}
  qcodes=new Uint8Array(buf.slice(p,p+E));
}
function typeNamesFor(i){return [types[typeIdx[i]]||'',classes[classIdx[i]]||'']}
function matchAlias(alias,i){const [t,c]=typeNamesFor(i),s=(t+' '+c).toLowerCase();
  if(alias==='VIS_ME')return t==='LC10a'||s.includes('lc10a');
  if(alias==='VIS_LPTC')return t==='LC4'||t==='LPLC2'||s.includes('lc4')||s.includes('lplc2');
  if(alias==='VIS_LO')return t==='LPLC1'||s.includes('lplc1');
  if(alias==='OLF_ORN_FOOD')return s.includes('orn')||s.includes('olfactory');
  if(alias==='MECH_BRISTLE')return s.includes('mechanosensory')||s.includes('bristle')||s.includes('mechanoreceptor');
  if(alias==='MECH_JO')return s.includes('johnston');
  if(alias==='CX_PFN')return s.includes('pfn');
  if(alias==='CX_FC')return s.includes('fan-shaped')||s.includes('fan_shaped')||s.includes('fc');
  if(alias==='CX_HDELTA')return s.includes('hdelta')||s.includes('hdelta');
  if(alias==='GNG_DESC')return c==='descending_neuron'||s.includes('dng100')||s.includes('dng');
  if(alias==='VNC_CPG')return s.includes('dng100')||s.includes('motor')||s.includes('vnc');
  return false;
}
function buildSamples(){
  aliasSamples={};for(const a of ALIASES)aliasSamples[a]=[];
  const counts=Object.fromEntries(ALIASES.map(a=>[a,0]));
  for(let i=0;i<N;i++)for(const a of ALIASES)if(counts[a]<MAX_SAMPLE&&matchAlias(a,i)){aliasSamples[a].push(i);counts[a]++}
}
function stimulateAlias(name,intensity){const idx=aliasSamples[name]||[];for(let k=0;k<idx.length;k++)if(V[idx[k]]<1)V[idx[k]]+=intensity}
function applyStim(){for(const [name,intensity] of Object.entries(stimuli))stimulateAlias(name,Number(intensity)||0)}
function weight(e){const code=qcodes[e]&127;return Math.exp(lnMin*(1-code/127))*((qcodes[e]&128)?-1:1)}
function step(){
  applyStim();
  // Leak + calibrated tonic. Propagate only neurons that fired last tick.
  for(let i=0;i<N;i++)V[i]=V[i]*DECAY+TONIC*(1-DECAY);
  for(let k=0;k<fired.length;k++){const pre=fired[k];for(let e=indptr[pre];e<indptr[pre+1];e++)V[targets[e]]+=GAIN*weight(e)}
  const next=[];const groups=new Uint32Array(ALIASES.length);
  for(let i=0;i<N;i++)if(V[i]>=THRESHOLD){V[i]=0;next.push(i);for(let g=0;g<ALIASES.length;g++)if(matchAlias(ALIASES[g],i))groups[g]++}
  fired=next;tickNo++;self.postMessage({type:'tick',total:next.length,groups:Array.from(groups),tick:tickNo});
}
async function init(){
  self.postMessage({type:'status',message:'Loading fly.ai web connectome metadata…'});
  const info=await getJson(BRAIN_URL);N=info.neurons;E=info.connections;
  parseMeta(await gunzip(await getBinary(META_URL)));
  self.postMessage({type:'status',message:`Downloading fly.ai connectome (${info.weights_mb} MB compressed)…`});
  const buffers=[];for(let i=0;i<info.parts.length;i++){self.postMessage({type:'status',message:`Downloading brain weights ${i+1}/${info.parts.length}…`});buffers.push(new Uint8Array(await getBinary(ROOT+info.parts[i])))}
  const total=buffers.reduce((n,b)=>n+b.byteLength,0),joined=new Uint8Array(total);let p=0;for(const b of buffers){joined.set(b,p);p+=b.byteLength}
  self.postMessage({type:'status',message:'Decompressing and decoding 166,700-neuron brain…'});
  decodeWeights(await gunzip(joined.buffer));buildSamples();V=new Float32Array(N);fired=[];
  self.postMessage({type:'ready',neurons:N,connections:E,groups:ALIASES,engine:'fly.ai web export',weightError:info.weight_error_mean});
}
self.onmessage=async e=>{const m=e.data;try{if(m.type==='init')await init();else if(m.type==='stimuli')stimuli=m.stimuli||{};else if(m.type==='reset'){if(V)V.fill(0);fired=[];tickNo=0}else if(m.type==='start'&&!running){running=true;loop()}else if(m.type==='stop')running=false}catch(err){self.postMessage({type:'error',message:err.message||String(err)})}};
function loop(){if(!running)return;const t=performance.now();step();setTimeout(loop,Math.max(1,TICK_MS-(performance.now()-t)))}
