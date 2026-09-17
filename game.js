/* Fruit Fly Brain 3D
   Browser-native software 3D renderer: no Three.js/CDN dependency, so it works
   on Android even when external script CDNs are blocked. The neural worker is
   still the real connectome-driven part of the simulation.
*/
const $=id=>document.getElementById(id);
const canvas=$('game'),ctx=canvas.getContext('2d');
const brainCanvas=$('brainCanvas'),bctx=brainCanvas.getContext('2d');
const state={ready:false,brainAvailable:false,groups:[],spikes:[],playerHP:100,flyHP:100,score:0,over:false,hitCooldown:0};
const keys=new Set();
const player={x:0,z:7,speed:5};
const fly={x:0,z:0,vx:0,vz:0,heading:0,phase:Math.random()*10};
const SIZE=22;
let worker=null,last=performance.now(),lastBrain=0;
const stars=Array.from({length:80},()=>({x:(Math.random()*2-1)*SIZE,z:(Math.random()*2-1)*SIZE,s:.5+Math.random()*1.5}));
const foods=Array.from({length:5},(_,i)=>{const a=i*Math.PI*2/5+.4,r=6+Math.random()*6;return{x:Math.cos(a)*r,z:Math.sin(a)*r,active:true}});

function resize(){const d=Math.min(devicePixelRatio||1,2);canvas.width=innerWidth*d;canvas.height=Math.max(320,Math.floor(innerHeight*.66))*d;canvas.style.width='100%';canvas.style.height='100%';brainCanvas.width=Math.max(320,brainCanvas.clientWidth*d);brainCanvas.height=Math.max(160,brainCanvas.clientHeight*d)}
addEventListener('resize',resize);resize();
$('brainStatus').textContent='3D renderer ready — starting brain simulation…';

function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function dist(a,b){return Math.hypot(a.x-b.x,a.z-b.z)}
function norm(name){const i=state.groups.indexOf(name);return i>=0?Math.min(1,state.spikes[i]/100):0}
function brainPost(m){if(!worker||!state.brainAvailable)return;try{worker.postMessage(m)}catch(_){state.brainAvailable=false}}

// Perspective projection for the browser-native 3D view.
function project(x,y,z){const dx=x-player.x,dz=z-player.z-4,dy=y;const ca=Math.cos(cameraYaw),sa=Math.sin(cameraYaw);const rx=dx*ca-dz*sa,rz=dx*sa+dz*ca;const depth=rz+15;if(depth<=.2)return null;const scale=canvas.height/(depth*1.65);return{x:canvas.width*.5+rx*scale,y:canvas.height*.57-dy*scale,scale,depth}}
let cameraYaw=0;
function poly(points,fill,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.stroke()}}
function sphere(o,r,base){const p=project(o.x,o.y,o.z);if(!p)return;const rr=Math.max(2,r*p.scale);const g=ctx.createRadialGradient(p.x-rr*.35,p.y-rr*.4,rr*.05,p.x,p.y,rr);g.addColorStop(0,'#ffffff');g.addColorStop(.18,base);g.addColorStop(1,'#101722');ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x,p.y,rr,0,Math.PI*2);ctx.fill()}
function drawWorld(){
  const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);
  const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#06101d');sky.addColorStop(1,'#10251e');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
  // Ground grid gives genuine depth/perspective without an external 3D library.
  for(let z=-SIZE;z<=SIZE;z+=2){const a=project(-SIZE,0,z),b=project(SIZE,0,z);if(a&&b){ctx.strokeStyle='rgba(70,220,170,.16)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}}
  for(let x=-SIZE;x<=SIZE;x+=2){const a=project(x,0,-SIZE),b=project(x,0,SIZE);if(a&&b){ctx.strokeStyle='rgba(70,220,170,.10)';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}}
  stars.forEach(s=>{const p=project(s.x,3+s.s,s.z);if(p){ctx.globalAlpha=.25;ctx.fillStyle='#b8eaff';ctx.fillRect(p.x,p.y,Math.max(1,p.scale*.025),Math.max(1,p.scale*.025));ctx.globalAlpha=1}});
  foods.filter(f=>f.active).forEach(f=>sphere({x:f.x,y:.35,z:f.z},.32,'#ff6b35'));
  // Fly: body, head, eyes and wings rendered as layered 3D projected shapes.
  const fp=project(fly.x,1.65,fly.z);if(fp){const r=Math.max(5,.78*fp.scale);sphere({x:fly.x,y:1.65,z:fly.z},.78,'#292929');sphere({x:fly.x,y:1.7,z:fly.z+.62},.43,'#161616');sphere({x:fly.x-.23,y:1.82,z:fly.z+.92},.16,'#c33cff');sphere({x:fly.x+.23,y:1.82,z:fly.z+.92},.16,'#c33cff');ctx.save();ctx.globalAlpha=.42;ctx.fillStyle='#bceeff';const left=project(fly.x-.7,2.05,fly.z),right=project(fly.x+.7,2.05,fly.z);if(left)ctx.ellipse(left.x,left.y,r*1.1,r*.25,-.25,0,Math.PI*2);if(right)ctx.ellipse(right.x,right.y,r*1.1,r*.25,.25,0,Math.PI*2);ctx.fill();ctx.restore()}
  sphere({x:player.x,y:.65,z:player.z},.58,'#38a9ff');
  // Arena boundary.
  const corners=[project(-SIZE,0,-SIZE),project(SIZE,0,-SIZE),project(SIZE,0,SIZE),project(-SIZE,0,SIZE)].filter(Boolean);if(corners.length===4){ctx.strokeStyle='#39e6a1';ctx.lineWidth=2;poly(corners,null,'#39e6a1')}
}

function sendStimuli(){if(!state.ready)return;const d=dist(fly,player),threat=clamp(1-d/9,0,1),food=foods.find(f=>f.active);const fd=food?Math.hypot(fly.x-food.x,fly.z-food.z):99;const foodSignal=clamp(1-fd/10,0,1);brainPost({type:'stimuli',stimuli:{VIS_ME:.18+threat*.8,VIS_LPTC:threat,VIS_LO:threat*.4,VIS_R1R6:.25,OLF_ORN_FOOD:foodSignal*.8,MECH_BRISTLE:d<1.4?1.5:0,MECH_JO:.08}})}
function handleBrainMessage(m){
  if(m.type==='status'){$('brainStatus').textContent=m.message;return}
  if(m.type==='error'){$('brainStatus').textContent='Brain error: '+m.message;state.brainAvailable=false;return}
  if(m.type==='ready'){state.ready=true;state.brainAvailable=true;state.groups=m.groups;state.spikes=new Array(m.groups.length).fill(0);$('brainStatus').textContent=`REAL CONNECTOME ONLINE · ${m.neurons.toLocaleString()} neurons · ${m.connections.toLocaleString()} connections`;brainPost({type:'start'});return}
  if(m.type==='tick'){state.spikes=m.groups;const approach=norm('CX_PFN')*.35+norm('CX_FC')*.3+norm('MB_MBON_APP')*.2+norm('LH_APP')*.15;const threat=norm('VIS_LPTC')*.45+norm('MECH_BRISTLE')*.25+norm('GNG_DESC')*.15+norm('CX_HDELTA')*.15;const turn=norm('CX_HDELTA'),motor=norm('GNG_DESC')+norm('VNC_CPG');const food=foods.find(f=>f.active);let tx=0,tz=0;if(food){tx=food.x-fly.x;tz=food.z-fly.z;const l=Math.hypot(tx,tz)||1;tx/=l;tz/=l}const px=player.x-fly.x,pz=player.z-fly.z,pl=Math.hypot(px,pz)||1,fleeX=-px/pl,fleeZ=-pz/pl;fly.heading+=(turn-.15)*(threat>.25?1.5:.6);let dx=Math.cos(fly.heading),dz=Math.sin(fly.heading);if(threat>.18){dx=fleeX*.8+dx*.2;dz=fleeZ*.8+dz*.2}else if(approach>.08){dx=dx*.35+tx*.65;dz=dz*.35+tz*.65}const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;const drive=clamp(.25+motor*.7+approach*.8+threat,0,1);fly.vx+=(dx*(.25+drive*.5)-fly.vx)*.25;fly.vz+=(dz*(.25+drive*.5)-fly.vz)*.25;fly.x+=fly.vx;fly.z+=fly.vz;if(Math.abs(fly.x)>SIZE-1)fly.vx*=-.9;if(Math.abs(fly.z)>SIZE-1)fly.vz*=-.9;$('brainState').textContent=threat>.3?'ESCAPE':approach>.12?'SEEK FOOD':motor>.18?'MOVE':'IDLE';$('neurons').textContent=`${m.total.toLocaleString()} spikes / brain tick`;drawBrain()}}
function drawBrain(){const c=brainCanvas,x=bctx,w=c.width,h=c.height;x.clearRect(0,0,w,h);x.fillStyle='#07101b';x.fillRect(0,0,w,h);const names=['VIS_ME','VIS_LPTC','OLF_ORN_FOOD','MECH_BRISTLE','MECH_JO','CX_PFN','CX_FC','CX_HDELTA','GNG_DESC','VNC_CPG'];names.forEach((n,i)=>{const v=norm(n),bw=w/names.length-5,bh=v*(h-30);x.fillStyle=v>.25?'#ff5c8a':'#38e8a4';x.fillRect(i*w/names.length+2,h-22-bh,bw,bh);x.fillStyle='#a9c0d6';x.font=`${Math.max(9,10*(devicePixelRatio||1))}px sans-serif`;x.fillText(n.replace('OLF_ORN_','').replace('MECH_',''),i*w/names.length+2,h-6)})}

function attack(){if(state.over||state.hitCooldown>0)return;state.hitCooldown=.35;if(dist(player,fly)<2.1){state.flyHP=Math.max(0,state.flyHP-18);state.score+=18;if(!state.flyHP)end(true)}else brainPost({type:'stimuli',stimuli:{MECH_BRISTLE:1.8}});ui()}
function end(win){state.over=true;$('message').textContent=win?'🧠 Brain-driven fly defeated!':'🪰 The fly wins!';$('message').classList.remove('hidden')}
function reset(){state.playerHP=100;state.flyHP=100;state.score=0;state.over=false;player.x=0;player.z=7;fly.x=0;fly.z=0;fly.vx=fly.vz=0;foods.forEach(f=>f.active=true);brainPost({type:'reset'});$('message').classList.add('hidden');ui()}
function playerStep(dt){let x=0,z=0;if(keys.has('w')||keys.has('arrowup'))z--;if(keys.has('s')||keys.has('arrowdown'))z++;if(keys.has('a')||keys.has('arrowleft'))x--;if(keys.has('d')||keys.has('arrowright'))x++;const l=Math.hypot(x,z)||1;player.x=clamp(player.x+x/l*player.speed*dt,-SIZE+1,SIZE-1);player.z=clamp(player.z+z/l*player.speed*dt,-SIZE+1,SIZE-1);cameraYaw+=(player.x*.0005-cameraYaw)*.05}
function combat(dt){state.hitCooldown=Math.max(0,state.hitCooldown-dt);if(dist(player,fly)<1.15&&state.hitCooldown<=0&&!state.over){state.playerHP=Math.max(0,state.playerHP-10);state.hitCooldown=.8;if(!state.playerHP)end(false)}}
function ui(){$('playerHealth').textContent=Math.ceil(state.playerHP);$('flyHealth').textContent=Math.ceil(state.flyHP);$('score').textContent=state.score}
function animate(t){const dt=Math.min(.05,(t-last)/1000);last=t;if(!state.over)playerStep(dt);combat(dt);sendStimuli();drawWorld();ui();requestAnimationFrame(animate)}
addEventListener('keydown',e=>{keys.add(e.key.toLowerCase());if(e.code==='Space'){e.preventDefault();attack()}if(e.key.toLowerCase()==='r')reset()});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
$('reset').addEventListener('click',reset);canvas.addEventListener('pointerdown',attack);$('attackTouch').addEventListener('pointerdown',e=>{e.preventDefault();attack()});
document.querySelectorAll('[data-key]').forEach(btn=>{const k=btn.dataset.key;const down=e=>{e.preventDefault();keys.add(k)};const up=e=>{e.preventDefault();keys.delete(k)};btn.addEventListener('pointerdown',down);btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',up);btn.addEventListener('pointerleave',up)});
reset();animate(performance.now());
try{worker=new Worker('./brain-worker.js');worker.onmessage=e=>handleBrainMessage(e.data);worker.onerror=()=>{$('brainStatus').textContent='Brain worker unavailable — 3D game continues without it.';state.brainAvailable=false};worker.postMessage({type:'init'})}catch(_){$('brainStatus').textContent='Brain simulation unavailable — 3D game is still running.'}
