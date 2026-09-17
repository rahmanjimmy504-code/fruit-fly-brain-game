/* Fruit Fly Brain — fly.ai MaleCNS web-export worker.
   IMPORTANT: fly.ai's committed web-export .bin files are already raw binary;
   they are NOT gzip-compressed. This worker keeps the full connectome and runs
   a browser LIF simulation without requiring Python/native code.
*/
const ROOT='https://raw.githubusercontent.com/alextitonis/fly.ai/main/world/public/connectome/';
const BRAIN_URL=ROOT+'brain.json',META_URL=ROOT+'meta.bin';
const DT=.020,TAU=.100,DECAY=Math.exp(-DT/TAU),GAIN=3.0,TONIC=.14,THRESHOLD=1,MAX_SAMPLE=1800,TICK_MS=80;
let N=0,E=0,lnMin=0,indptr,targets,qcodes,V,fired,types=[],classes=[],typeIdx,classIdx,side,aliasMask;
let aliasSamples={},running=false,stimuli={},tickNo=0;
const ALIASES=['VIS_ME','VIS_LPTC','VIS_LO','OLF_ORN_FOOD','MECH_BRISTLE','MECH_JO','CX_PFN','CX_FC','CX_HDELTA','GNG_DESC','VNC_CPG'];

async function getJson(url){const r=await fetch(url,{cache:'force-cache'});if(!r.ok)throw Error('Fetch failed: HTTP '+r.status);return r.json()}
async function getBinary(url){const r=await fetch(url,{cache:'force-cache'});if(!r.ok)throw Error('Fetch failed: HTTP '+r.status);return r.arrayBuffer()}
function readVarints(bytes,pos,count){const out=new Uint32Array(count);let p=pos;for(let i=0;i<count;i++){let v=0,s=0,b;do{if(p>=bytes.length)throw Error('Unexpected end of connectome varints');b=bytes[p++];v+=(b&127)*2**s;s+=7;if(s>35)throw Error('Invalid connectome varint')}while(b&128);out[i]=v>>>0}return [out,p]}
function parseMeta(buf){
  const d=new DataView(buf);if(d.byteLength<16||d.getUint32(0,false)!==0x464c594d)throw Error('Invalid fly.ai meta header');
  const n=d.getUint32(8,true),len=d.getUint32(12,true);if(n!==N)throw Error(`Metadata neuron count ${n} does not match weights ${N}`);const header=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,16,len)));let p=16+len;
  typeIdx=new Uint16Array(buf.slice(p,p+n*2));p+=n*2;classIdx=new Uint8Array(buf.slice(p,p+n));p+=n;side=new Uint8Array(buf.slice(p,p+n));types=header.types;classes=header.superclasses;
}
function decodeWeights(buf){
  const bytes=new Uint8Array(buf),d=new DataView(buf);if(d.byteLength<20||d.getUint32(0,false)!==0x464c5957)throw Error('Invalid fly.ai weight header (expected raw FLYW binary)');
  const version=d.getUint32(4,true);if(version!==1)throw Error('Unsupported fly.ai weight version '+version);N=d.getUint32(8,true);E=d.getUint32(12,true);lnMin=d.getFloat32(16,true);let p=20;
  const degreesAndPos=readVarints(bytes,p,N);const degrees=degreesAndPos[0];p=degreesAndPos[1];indptr=new Uint32Array(N+1);let acc=0;for(let i=0;i<N;i++){indptr[i]=acc;acc+=degrees[i]}indptr[N]=acc;if(acc!==E)throw Error(`Connectome edge count mismatch: decoded ${acc}, expected ${E}`);
  const gapsAndPos=readVarints(bytes,p,E);targets=gapsAndPos[0];p=gapsAndPos[1];for(let i=0;i<N;i++){let absolute=0;for(let e=indptr[i];e<indptr[i+1];e++){absolute=e===indptr[i]?targets[e]:absolute+targets[e];targets[e]=absolute}}
  if(p+E>bytes.length)throw Error('Connectome weight payload is truncated');qcodes=new Uint8Array(bytes.slice(p,p+E));
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
  if(alias==='CX_FC')return s.includes('fan-shaped')||s.includes('fan_shaped');
  if(alias==='CX_HDELTA')return s.includes('hdelta');
  if(alias==='GNG_DESC')return c==='descending_neuron'||s.includes('dng100')||s.includes('dng');
  if(alias==='VNC_CPG')return s.includes('dng100')||s.includes('motor')||s.includes('vnc');
  return false;
}
function buildSamples(){aliasSamples={};aliasMask=new Uint16Array(N);for(const a of ALIASES)aliasSamples[a]=[];for(let i=0;i<N;i++)for(let g=0;g<ALIASES.length;g++)if(aliasSamples[ALIASES[g]].length<MAX_SAMPLE&&matchAlias(ALIASES[g],i)){aliasSamples[ALIASES[g]].push(i);aliasMask[i]|=1<<g}}
function stimulateAlias(name,intensity){const idx=aliasSamples[name]||[];for(let k=0;k<idx.length;k++)V[idx[k]]+=intensity}
function applyStim(){for(const [name,intensity] of Object.entries(stimuli))stimulateAlias(name,Number(intensity)||0)}
function step(){
  applyStim();for(let i=0;i<N;i++)V[i]=V[i]*DECAY+TONIC*(1-DECAY);
  for(let k=0;k<fired.length;k++){const pre=fired[k];for(let e=indptr[pre];e<indptr[pre+1];e++)V[targets[e]]+=GAIN*weight(e)}
  const next=[];const groups=new Uint32Array(ALIASES.length);for(let i=0;i<N;i++)if(V[i]>=THRESHOLD){V[i]=0;next.push(i);const mask=aliasMask[i];for(let g=0;g<ALIASES.length;g++)if(mask&(1<<g))groups[g]++}fired=next;tickNo++;self.postMessage({type:'tick',total:next.length,groups:Array.from(groups),tick:tickNo})
}
function weight(e){const code=qcodes[e]&127;return Math.exp(lnMin*(1-code/127))*((qcodes[e]&128)?-1:1)}
async function init(){
  self.postMessage({type:'status',message:'Loading fly.ai brain metadata…'});const info=await getJson(BRAIN_URL);N=info.neurons;E=info.connections;
  parseMeta(await getBinary(META_URL));
  const buffers=[];for(let i=0;i<info.parts.length;i++){self.postMessage({type:'status',message:`Downloading brain weights ${i+1}/${info.parts.length} (${Math.round(info.weights_mb)} MB total)…`});buffers.push(new Uint8Array(await getBinary(ROOT+info.parts[i])))}
  const total=buffers.reduce((n,b)=>n+b.byteLength,0),joined=new Uint8Array(total);let p=0;for(const b of buffers){joined.set(b,p);p+=b.byteLength}
  self.postMessage({type:'status',message:'Decoding full 166,700-neuron connectome…'});decodeWeights(joined.buffer);buildSamples();V=new Float32Array(N);fired=[];
  self.postMessage({type:'ready',neurons:N,connections:E,groups:ALIASES,engine:'fly.ai web export',weightError:info.weight_error_mean})
}
self.onmessage=async e=>{const m=e.data;try{if(m.type==='init'&&!N)await init();else if(m.type==='stimuli')stimuli=m.stimuli||{};else if(m.type==='reset'){if(V)V.fill(0);fired=[];tickNo=0}else if(m.type==='start'&&!running){running=true;loop()}else if(m.type==='stop')running=false}catch(err){running=false;self.postMessage({type:'error',message:err.message||String(err)})}};
function loop(){if(!running)return;const t=performance.now();step();setTimeout(loop,Math.max(1,TICK_MS-(performance.now()-t)))}
