/* Lightweight WebGL-free neural monitor. It renders thousands of activity dots
 * efficiently on a canvas and exposes region activity to the game HUD.
 */
class BrainVisualizer {
  constructor(canvas){ this.canvas=canvas; this.ctx=canvas?.getContext('2d'); this.activity={}; this.history=[]; }
  setActivity(a){ this.activity={...this.activity,...a}; this.history.push({...this.activity}); if(this.history.length>90)this.history.shift(); }
  draw(){ if(!this.ctx)return; const c=this.canvas,w=c.width=c.clientWidth*devicePixelRatio,h=c.height=c.clientHeight*devicePixelRatio; const ctx=this.ctx; ctx.clearRect(0,0,w,h); ctx.save(); ctx.scale(devicePixelRatio,devicePixelRatio); const W=c.clientWidth,H=c.clientHeight;
    ctx.font='11px system-ui'; const groups=['VISION','ODOR','TASTE','TOUCH','CENTRAL','DRIVE','MOTOR'];
    groups.forEach((g,i)=>{const v=Math.max(0,Math.min(1,this.activity[g]||0)); const x=10+i*(W-20)/groups.length; const bw=Math.max(8,(W-30)/groups.length-6); ctx.fillStyle='rgba(255,255,255,.08)';ctx.fillRect(x,H-34,bw,20);ctx.fillStyle='rgba(100,220,255,.85)';ctx.fillRect(x,H-34,bw*v,20);ctx.fillStyle='#d9e7ef';ctx.fillText(g,x,H-39);});
    ctx.strokeStyle='rgba(100,220,255,.55)';ctx.beginPath(); this.history.forEach((s,i)=>{const v=((s.CENTRAL||0)+(s.MOTOR||0))/2;const x=i*(W-20)/89+10,y=H-60-v*35;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();ctx.restore(); }
}
window.BrainVisualizer=BrainVisualizer;
