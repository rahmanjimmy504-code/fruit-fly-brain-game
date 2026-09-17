const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const keys = new Set();
const ui = {
  playerHealth: document.getElementById('playerHealth'), flyHealth: document.getElementById('flyHealth'), brainState: document.getElementById('brainState'), score: document.getElementById('score'), message: document.getElementById('message'),
  output: document.getElementById('brainOutput')
};
const meters = ['threat', 'target', 'escape', 'attack', 'wall'].reduce((o, k) => { o[k] = document.getElementById(k); o[k+'Value'] = document.getElementById(k+'Value'); return o; }, {});

let W = 900, H = 600, last = performance.now(), score = 0, gameOver = false, attackCooldown = 0, flyAttackCooldown = 0;
const player = { x: 180, y: 300, r: 16, speed: 300, health: 100, invuln: 0 };
const fly = { x: 680, y: 300, vx: -40, vy: 0, r: 19, health: 100, phase: Math.random() * 10, brain: { threat: 0, target: 0, escape: 0, attack: 0, wall: 0, steer: 0, accel: 0, mode: 'SEARCH' } };

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = Math.max(360, rect.width); H = Math.max(360, rect.height);
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize); resize();

window.addEventListener('keydown', e => { keys.add(e.key.toLowerCase()); if (e.code === 'Space') { e.preventDefault(); attack(); } });
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); attack(); });

function reset() {
  player.x = W * .22; player.y = H * .5; player.health = 100; player.invuln = 0;
  fly.x = W * .76; fly.y = H * .5; fly.vx = -40; fly.vy = 0; fly.health = 100; fly.phase = Math.random() * 10;
  score = 0; gameOver = false; attackCooldown = 0; flyAttackCooldown = 0; ui.message.classList.add('hidden');
}
document.getElementById('reset').addEventListener('click', reset);

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function norm(x, y) { const d = Math.hypot(x, y) || 1; return { x: x/d, y: y/d }; }

// Original lightweight neural-state controller. The inputs/outputs mirror the
// sensor -> controller -> motor architecture used by embodied fly experiments.
function updateBrain(dt) {
  const dx = player.x - fly.x, dy = player.y - fly.y, d = Math.hypot(dx, dy);
  const target = clamp(1 - d / 500, 0, 1);
  const threat = clamp(1 - d / 280, 0, 1) * (player.health > 0 ? 1 : 0);
  const wall = clamp(Math.max(0, 90 - Math.min(fly.x, W-fly.x, fly.y, H-fly.y)) / 90, 0, 1);
  const escape = clamp(threat * .85 + wall * .35, 0, 1);
  const attack = clamp((1 - d / 155), 0, 1) * (1 - threat * .45);

  // Recurrent state adds inertia so the fly does not teleport between decisions.
  fly.brain.threat += (threat - fly.brain.threat) * Math.min(1, dt * 7);
  fly.brain.target += (target - fly.brain.target) * Math.min(1, dt * 5);
  fly.brain.escape += (escape - fly.brain.escape) * Math.min(1, dt * 8);
  fly.brain.attack += (attack - fly.brain.attack) * Math.min(1, dt * 8);
  fly.brain.wall += (wall - fly.brain.wall) * Math.min(1, dt * 8);

  const toPlayer = norm(dx, dy);
  const away = { x: -toPlayer.x, y: -toPlayer.y };
  const wallX = (fly.x < 90 ? 1 : 0) - (fly.x > W-90 ? 1 : 0);
  const wallY = (fly.y < 90 ? 1 : 0) - (fly.y > H-90 ? 1 : 0);
  const wander = { x: Math.cos(fly.phase * 1.7), y: Math.sin(fly.phase * 2.1) };

  let steer;
  let mode;
  if (fly.brain.escape > .58) {
    steer = norm(away.x * 1.5 + wallX * 1.8 + wander.x * .35, away.y * 1.5 + wallY * 1.8 + wander.y * .35);
    mode = 'EVADE';
  } else if (fly.brain.attack > .72) {
    steer = norm(toPlayer.x * .75 + wander.x * .25, toPlayer.y * .75 + wander.y * .25);
    mode = 'ATTACK';
  } else if (fly.brain.target > .15) {
    steer = norm(toPlayer.x * .45 + wander.x * .75 + wallX, toPlayer.y * .45 + wander.y * .75 + wallY);
    mode = 'TRACK';
  } else {
    steer = norm(wander.x + wallX, wander.y + wallY);
    mode = 'SEARCH';
  }
  fly.brain.steer = steer.x;
  fly.brain.accel = clamp(.25 + fly.brain.target * .55 + fly.brain.escape * .9, 0, 1);
  fly.brain.mode = mode;
}

function movePlayer(dt) {
  let x = 0, y = 0;
  if (keys.has('a') || keys.has('arrowleft')) x--; if (keys.has('d') || keys.has('arrowright')) x++;
  if (keys.has('w') || keys.has('arrowup')) y--; if (keys.has('s') || keys.has('arrowdown')) y++;
  if (x || y) { const n = norm(x, y); player.x += n.x * player.speed * dt; player.y += n.y * player.speed * dt; }
  player.x = clamp(player.x, player.r, W-player.r); player.y = clamp(player.y, player.r, H-player.r);
  player.invuln = Math.max(0, player.invuln - dt);
}

function attack() {
  if (gameOver || attackCooldown > 0) return;
  attackCooldown = .35;
  if (dist(player, fly) < 115) { fly.health = Math.max(0, fly.health - 18); score += 100; if (fly.health <= 0) endGame('YOU WIN! 🪰💥'); }
}

function updateFly(dt) {
  fly.phase += dt;
  updateBrain(dt);
  const dx = fly.brain.steer, dy = Math.sin(fly.phase * 2.1) * .35 + (fly.y < H*.12 ? .4 : 0) - (fly.y > H*.88 ? .4 : 0);
  const n = norm(dx, dy);
  const desired = 75 + fly.brain.accel * 150;
  fly.vx += (n.x * desired - fly.vx) * Math.min(1, dt * 2.8);
  fly.vy += (n.y * desired - fly.vy) * Math.min(1, dt * 2.8);
  fly.x += fly.vx * dt; fly.y += fly.vy * dt;
  if (fly.x < fly.r || fly.x > W-fly.r) fly.vx *= -.8;
  if (fly.y < fly.r || fly.y > H-fly.r) fly.vy *= -.8;
  fly.x = clamp(fly.x, fly.r, W-fly.r); fly.y = clamp(fly.y, fly.r, H-fly.r);

  flyAttackCooldown = Math.max(0, flyAttackCooldown - dt);
  if (dist(player, fly) < 48 && flyAttackCooldown <= 0 && fly.brain.mode === 'ATTACK') {
    flyAttackCooldown = 1.0; if (player.invuln <= 0) { player.health = Math.max(0, player.health - 8); player.invuln = .35; score = Math.max(0, score - 25); if (player.health <= 0) endGame('FLY WINS! 🪰'); }
  }
}

function endGame(text) { gameOver = true; ui.message.textContent = text; ui.message.classList.remove('hidden'); }

function drawBackground() {
  ctx.fillStyle = '#0b1020'; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle = '#18243e'; ctx.lineWidth = 1;
  for (let x=0;x<W;x+=45) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y=0;y<H;y+=45) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
}
function drawEntity(x,y,r,body,accent) {
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle=body; ctx.fill(); ctx.lineWidth=3; ctx.strokeStyle=accent; ctx.stroke();
}
function draw() {
  drawBackground();
  // attack range
  ctx.beginPath(); ctx.arc(player.x,player.y,115,0,Math.PI*2); ctx.strokeStyle='#35506b55'; ctx.stroke();
  // player
  drawEntity(player.x, player.y, player.r, '#4aa3ff', '#bfe6ff');
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(player.x+5,player.y-4,3,0,Math.PI*2); ctx.fill();
  // fly wings
  ctx.globalAlpha=.32; ctx.fillStyle='#dce8ff'; ctx.beginPath(); ctx.ellipse(fly.x-12,fly.y-12,20,9,-.5,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.ellipse(fly.x+12,fly.y-12,20,9,.5,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
  drawEntity(fly.x, fly.y, fly.r, '#161922', '#d8a55a');
  ctx.fillStyle='#ff536b'; ctx.beginPath(); ctx.arc(fly.x-6,fly.y-5,3,0,Math.PI*2); ctx.arc(fly.x+6,fly.y-5,3,0,Math.PI*2); ctx.fill();
  // health bars
  bar(player.x-30,player.y-30,60,6,player.health/100); bar(fly.x-35,fly.y-34,70,6,fly.health/100);
  if (!gameOver) {
    ctx.fillStyle='#8796b8'; ctx.font='12px system-ui'; ctx.fillText(fly.brain.mode, fly.x-25, fly.y+39);
  }
}
function bar(x,y,w,h,p) { ctx.fillStyle='#111827'; ctx.fillRect(x,y,w,h); ctx.fillStyle='#61d58c'; ctx.fillRect(x,y,w*clamp(p,0,1),h); }

function updateUI() {
  ui.playerHealth.textContent = Math.round(player.health); ui.flyHealth.textContent = Math.round(fly.health); ui.brainState.textContent = fly.brain.mode; ui.score.textContent = score;
  for (const k of ['threat','target','escape','attack','wall']) { const v=fly.brain[k]; meters[k].value=v; meters[k+'Value'].textContent=v.toFixed(2); }
  ui.output.textContent = `steer: ${fly.brain.steer.toFixed(2)}\naccel: ${fly.brain.accel.toFixed(2)}\nmode: ${fly.brain.mode}`;
}

function loop(now) {
  const dt = Math.min(.033, (now-last)/1000); last=now;
  if (!gameOver) { attackCooldown=Math.max(0,attackCooldown-dt); movePlayer(dt); updateFly(dt); }
  draw(); updateUI(); requestAnimationFrame(loop);
}
reset(); requestAnimationFrame(loop);
