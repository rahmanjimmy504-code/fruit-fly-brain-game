/* Procedural fly habitat: deterministic decorations + sensory fields. */
class FlyWorld {
  constructor(seed=1337){ this.seed=seed; this.items=[]; this.odors=[]; this.wind={x:.15,y:0}; let r=seed>>>0; const rnd=()=>((r=(r*1664525+1013904223)>>>0)/4294967296);
    for(let i=0;i<55;i++) this.items.push({x:40+rnd()*900,y:40+rnd()*520,type:i%7===0?'flower':i%11===0?'rock':i%5===0?'leaf':'grass',s:.5+rnd()*1.5,a:rnd()*6.28});
    for(let i=0;i<5;i++) this.odors.push({x:120+rnd()*780,y:80+rnd()*440,r:55+rnd()*70,strength:.35+rnd()*.65}); }
  sampleOdor(x,y){let v=0;for(const o of this.odors){const d=Math.hypot(x-o.x,y-o.y);v+=Math.max(0,1-d/o.r)*o.strength;}return Math.min(1,v);}
  draw(ctx,camera){ctx.save();ctx.translate(-camera.x,-camera.y);ctx.fillStyle='#102018';ctx.fillRect(0,0,980,600);ctx.strokeStyle='rgba(130,190,130,.08)';for(let x=0;x<980;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,600);ctx.stroke();}for(let y=0;y<600;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(980,y);ctx.stroke();}
    for(const o of this.odors){const g=ctx.createRadialGradient(o.x,o.y,0,o.x,o.y,o.r);g.addColorStop(0,'rgba(255,190,70,.10)');g.addColorStop(1,'rgba(255,190,70,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,Math.PI*2);ctx.fill();}
    for(const p of this.items){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);ctx.scale(p.s,p.s);if(p.type==='flower'){ctx.fillStyle='#ffb0df';for(let i=0;i<5;i++){ctx.rotate(1.256);ctx.beginPath();ctx.ellipse(0,-7,4,8,0,0,Math.PI*2);ctx.fill();}ctx.fillStyle='#ffd36a';ctx.beginPath();ctx.arc(0,0,3,0,Math.PI*2);ctx.fill();}else if(p.type==='rock'){ctx.fillStyle='#66706b';ctx.beginPath();ctx.ellipse(0,0,10,6,.2,0,Math.PI*2);ctx.fill();}else{ctx.fillStyle=p.type==='leaf'?'#3f8b52':'#49764a';ctx.beginPath();ctx.ellipse(0,0,13,4,.4,0,Math.PI*2);ctx.fill();}ctx.restore();}ctx.restore();}
}
window.FlyWorld=FlyWorld;
