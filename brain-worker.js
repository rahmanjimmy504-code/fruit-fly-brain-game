/*
 * Full-connectome worker for the 3D game.
 *
 * The binary is the public FlyWire FAFB v783-derived browser pack used by
 * snedea/flybrain: 139,255 neurons / 2,698,236 directed connections.
 * We simulate the supplied neurons with leaky integrate-and-fire dynamics.
 * The game layer only supplies sensory currents and reads descending/motor
 * population activity; it does not invent the neural wiring.
 */
const CONNECTOME_URL = 'https://raw.githubusercontent.com/snedea/flybrain/main/data/connectome.bin.gz';
const META_URL = 'https://raw.githubusercontent.com/snedea/flybrain/main/data/neuron_meta.json';
const LEAK = 0.95;
const THRESHOLD = 1.0;
const REFRACTORY = 3;
const WEIGHT_SCALE = 0.15;
const TICK_MS = 100;
const MAX_STIM_PER_GROUP = 2500;

let N=0, E=0, rowPtr, colIdx, weights, V, fired, refr, groupId;
let groupNames=[], nameToId={}, groupRanges=[];
let running=false, stimuli={}, tickNo=0;
let lastGroupSpikes=[];

async function gunzip(buf){
  const ds=new DecompressionStream('gzip');
  const w=ds.writable.getWriter(); w.write(new Uint8Array(buf)); w.close();
  const r=ds.readable.getReader(), chunks=[]; let total=0;
  while(true){const x=await r.read(); if(x.done) break; chunks.push(x.value); total+=x.value.byteLength;}
  const out=new Uint8Array(total); let p=0; for(const c of chunks){out.set(c,p);p+=c.byteLength;} return out.buffer;
}

async function init(){
  self.postMessage({type:'status', message:'Downloading real FlyWire connectome…'});
  const meta=await fetch(META_URL).then(r=>r.json());
  groupNames=meta.groups.map(g=>g.name); groupNames.forEach((n,i)=>nameToId[n]=i);
  const raw=await fetch(CONNECTOME_URL);
  if(!raw.ok) throw new Error('Connectome download failed: HTTP '+raw.status);
  const compressed=await raw.arrayBuffer();
  self.postMessage({type:'status', message:'Decompressing 139k-neuron connectome…'});
  const buffer=await gunzip(compressed);
  parse(buffer);
  self.postMessage({type:'ready', neurons:N, connections:E, groups:groupNames});
}

function parse(buffer){
  const dv=new DataView(buffer); N=dv.getUint32(0,true); E=dv.getUint32(4,true);
  const edgeBase=8, metaBase=edgeBase+E*12;
  rowPtr=new Uint32Array(N+1); colIdx=new Uint32Array(E); weights=new Float32Array(E);
  let maxW=0;
  for(let e=0;e<E;e++){const b=edgeBase+e*12; const pre=dv.getUint32(b,true); rowPtr[pre+1]++;}
  for(let i=1;i<=N;i++) rowPtr[i]+=rowPtr[i-1];
  const cursor=new Uint32Array(rowPtr);
  for(let e=0;e<E;e++){
    const b=edgeBase+e*12, pre=dv.getUint32(b,true), post=dv.getUint32(b+4,true), w=dv.getFloat32(b+8,true);
    const k=cursor[pre]++; colIdx[k]=post; weights[k]=w; if(Math.abs(w)>maxW) maxW=Math.abs(w);
  }
  if(maxW) for(let e=0;e<E;e++) weights[e]=(weights[e]/maxW)*WEIGHT_SCALE;
  groupId=new Uint16Array(N);
  for(let i=0;i<N;i++) groupId[i]=dv.getUint16(metaBase+i*3+1,true);
  V=new Float32Array(N); fired=new Uint8Array(N); refr=new Uint8Array(N);
  buildRanges();
}

function buildRanges(){
  const min=new Uint32Array(groupNames.length); const max=new Uint32Array(groupNames.length);
  min.fill(N); max.fill(0);
  for(let i=0;i<N;i++){const g=groupId[i]; if(i<min[g]) min[g]=i; if(i+1>max[g]) max[g]=i+1;}
  // group IDs are not guaranteed contiguous, so make explicit index lists.
  groupRanges=groupNames.map((name,g)=>{
    const count=Math.min(MAX_STIM_PER_GROUP, max[g]-min[g]); const a=new Uint32Array(count);
    if(count<=0) return a;
    const stride=Math.max(1,Math.floor((max[g]-min[g])/count)); let k=0;
    for(let i=min[g];i<max[g] && k<count;i+=stride) if(groupId[i]===g) a[k++]=i;
    return k===count?a:a.slice(0,k);
  });
}

function applyStim(){
  for(const [name,intensity] of Object.entries(stimuli)){
    const id=nameToId[name]; if(id===undefined) continue;
    const idx=groupRanges[id]||[];
    for(let k=0;k<idx.length;k++){const i=idx[k]; if(refr[i]===0) V[i]+=intensity;}
  }
}

function step(){
  const groupCounts=new Uint32Array(groupNames.length);
  for(let i=0;i<N;i++){
    if(refr[i]>0){refr[i]--; V[i]=0;} else V[i]*=LEAK;
  }
  applyStim();
  for(let i=0;i<N;i++) if(fired[i]){
    for(let j=rowPtr[i];j<rowPtr[i+1];j++) V[colIdx[j]]+=weights[j];
  }
  let total=0;
  for(let i=0;i<N;i++){
    fired[i]=0;
    if(refr[i]===0 && V[i]>=THRESHOLD){fired[i]=1; V[i]=0; refr[i]=REFRACTORY; total++; groupCounts[groupId[i]]++;}
  }
  lastGroupSpikes=Array.from(groupCounts);
  tickNo++;
  self.postMessage({type:'tick', total, groups:lastGroupSpikes, tick:tickNo});
}

self.onmessage=async e=>{
  const m=e.data;
  try{
    if(m.type==='init') await init();
    else if(m.type==='stimuli') stimuli=m.stimuli||{};
    else if(m.type==='reset'){V.fill(0); fired.fill(0); refr.fill(0); tickNo=0;}
    else if(m.type==='start' && !running){running=true; loop();}
    else if(m.type==='stop') running=false;
  }catch(err){self.postMessage({type:'error',message:err.message||String(err)});}
};

function loop(){
  if(!running) return;
  const t=performance.now(); step();
  setTimeout(loop,Math.max(1,TICK_MS-(performance.now()-t)));
}
