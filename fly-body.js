/* Procedural, browser-native Drosophila body renderer.
 * Inspired by NeuroMechFly/FlyBody: segmented body, six legs, wings,
 * antennae and abdomen. No external assets are required.
 */
class FlyBody {
  constructor() { this.phase = 0; this.wing = 0; this.walk = 0; this.hit = 0; this.flying = false; }
  update(dt, moving, flying, hit) {
    this.phase += dt * (moving ? 9 : 2.2);
    this.walk += dt * (moving ? 12 : 1.5);
    this.flying = flying;
    this.hit = Math.max(0, this.hit - dt);
    if (hit) this.hit = 0.18;
    this.wing = flying ? Math.sin(this.phase * 8) * 0.22 : Math.sin(this.phase * 3) * 0.025;
  }
  draw(ctx, x, y, angle, scale=1) {
    ctx.save(); ctx.translate(x,y); ctx.rotate(angle); ctx.scale(scale,scale);
    const bob = this.flying ? Math.sin(this.phase*2)*3 : 0; ctx.translate(0,bob);
    ctx.globalAlpha = 0.22; ctx.fillStyle='#000'; ctx.beginPath(); ctx.ellipse(0,18,32,11,0,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
    // Wings: fast oscillation gives a real animated wing-beat cue.
    const wa = this.wing;
    for (const s of [-1,1]) { ctx.save(); ctx.rotate(s*(0.32+wa)); ctx.fillStyle='rgba(210,235,255,.45)'; ctx.strokeStyle='rgba(170,210,240,.8)'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.ellipse(s*18,-12,28,8,s*0.18,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.restore(); }
    // Abdomen segments.
    for(let i=0;i<5;i++){ ctx.fillStyle=i%2?'#332b27':'#5a4233'; ctx.beginPath(); ctx.ellipse(22+i*8,3,11,8,0,0,Math.PI*2); ctx.fill(); }
    // Thorax/head.
    ctx.fillStyle='#4a382e'; ctx.beginPath(); ctx.ellipse(5,2,17,13,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#2a211d'; ctx.beginPath(); ctx.ellipse(-15,1,11,9,0,0,Math.PI*2); ctx.fill();
    // Compound eyes.
    ctx.fillStyle='#24151a'; ctx.beginPath(); ctx.ellipse(-20,-5,6,7,0,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.ellipse(-20,7,6,7,0,0,Math.PI*2); ctx.fill();
    // Antennae.
    ctx.strokeStyle='#b89b84'; ctx.lineWidth=1; for(const s of [-1,1]){ctx.beginPath();ctx.moveTo(-24,s*4);ctx.quadraticCurveTo(-34,s*11,-38,s*17);ctx.stroke();}
    // Six articulated legs.
    ctx.strokeStyle='#6f5545'; ctx.lineWidth=3; for(let i=0;i<3;i++) for(const s of [-1,1]){
      const px=-2+i*10, sy=s*8, swing=Math.sin(this.walk+i*1.7+(s<0?Math.PI:0))*5;
      ctx.beginPath(); ctx.moveTo(px,sy); ctx.lineTo(px-8,sy+s*(12+swing)); ctx.lineTo(px-15,sy+s*(22-swing*0.4)); ctx.stroke();
    }
    if(this.hit>0){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,39,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
  }
}
window.FlyBody = FlyBody;
