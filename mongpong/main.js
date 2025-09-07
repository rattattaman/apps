// Pong con "Mods": velocidad en bote, cambio de tamaño y dos pelotas
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

const scoreL = document.getElementById('scoreL');
const scoreR = document.getElementById('scoreR');
const bounceL = document.getElementById('bounceL');
const bounceR = document.getElementById('bounceR');
const statusEl = document.getElementById('status');
const partyEl  = document.getElementById('party');

const modsBtn = document.getElementById('modsBtn');
const modsPanel = document.getElementById('modsPanel');
const modSpeedEl = document.getElementById('modSpeed');
const modSizeEl  = document.getElementById('modSize');
const modTwoEl   = document.getElementById('modTwo');
const modGiantEl = document.getElementById('modGiant');
const modMirrorEl= document.getElementById('modMirror');

const STATE = {
  w: 0, h: 0,
  paused: false,
  aiRight: true,
  targetScore: 7,
  left: { y: 0, vy: 0, score: 0, bounces: 0 },
  right:{ y: 0, vy: 0, score: 0, bounces: 0 },
  balls: [], // ahora soporta varias pelotas
  keys: { w:false, s:false, up:false, down:false },
  t0: performance.now(),
  mods: {
    speedOnBounce: false,  // +10% vel en cada bote
    sizeRandom: false,     // ±90% tamaño en cada bote
    twoBalls: false,       // dos pelotas
    giantAI: false,        // IA ocupa toda la portería
    mirror: false          // controles invertidos
  },
  party: false
};

const PAD = { w: 12, h: 120, margin: 20, speed: 520 };
const NET = { gap: 14 };

function createBall(dirX = 1) {
  const r = 9;
  const speed = 380;
  const angle = (Math.random() * 0.6 - 0.3);
  return {
    x: STATE.w / 2,
    y: STATE.h / 2,
    vx: Math.cos(angle) * speed * dirX,
    vy: Math.sin(angle) * speed,
    r,
    baseSpeed: speed
  };
}

function resize() {
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  canvas.width  = cssW * dpr;
  canvas.height = cssH * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  STATE.w = cssW; STATE.h = cssH;

  PAD.h = Math.max(60, Math.floor(cssH * 0.22));
  PAD.w = Math.max(10, Math.floor(cssW * 0.012));
  PAD.margin = Math.max(10, Math.floor(cssW * 0.02));
  NET.gap = 14;

  centerEntities();
}

function centerEntities() {
  STATE.left.y  = (STATE.h - PAD.h) / 2;
  STATE.right.y = (STATE.h - PAD.h) / 2;
  if (STATE.mods.giantAI) STATE.right.y = 0;

  // Re-crear pelotas según el mod activo
  STATE.balls = [ createBall(Math.random() < 0.5 ? -1 : 1) ];
  if (STATE.mods.twoBalls) {
    // segunda pelota en sentido opuesto
    STATE.balls.push(createBall(STATE.balls[0].vx > 0 ? -1 : 1));
  }
}

function blip(freq = 260) {
  try {
    if (!window.audioCtx) window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    g.gain.value = 0.02;
    o.connect(g).connect(audioCtx.destination);
    o.start();
    setTimeout(() => { o.stop(); o.disconnect(); g.disconnect(); }, 60);
  } catch {}
}

function draw() {
  // red central
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 2;
  for (let y = 0; y < STATE.h; y += NET.gap) {
    ctx.beginPath();
    ctx.moveTo(STATE.w/2, y);
    ctx.lineTo(STATE.w/2, y + NET.gap/2);
    ctx.stroke();
  }
  ctx.restore();

  // palas
  ctx.fillStyle = '#eaf2ff';
  ctx.fillRect(PAD.margin, STATE.left.y, PAD.w, PAD.h);
  const rightH = STATE.mods.giantAI ? STATE.h : PAD.h;
  ctx.fillRect(STATE.w - PAD.margin - PAD.w, STATE.right.y, PAD.w, rightH);

  // pelotas
  for (const b of STATE.balls) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
    ctx.fill();
  }

  // sombra sutil
  ctx.globalAlpha = 0.08;
  ctx.fillRect(PAD.margin+2, STATE.left.y+2, PAD.w, PAD.h);
  ctx.fillRect(STATE.w - PAD.margin - PAD.w + 2, STATE.right.y + 2, PAD.w, rightH);
  ctx.globalAlpha = 1;
}

function update(dt) {
  if (STATE.paused) return;

  // entrada P1
  STATE.left.vy = 0;
  if (STATE.keys.w) STATE.left.vy -= PAD.speed;
  if (STATE.keys.s) STATE.left.vy += PAD.speed;

  // P2 o IA
  STATE.right.vy = 0;
  if (!STATE.mods.giantAI) {
    if (STATE.aiRight) {
      const target = avgBallY() - PAD.h/2;
      const diff = target - STATE.right.y;
      const max = PAD.speed * 0.85;
      STATE.right.vy = Math.max(-max, Math.min(max, diff * 6));
    } else {
      if (STATE.keys.up)   STATE.right.vy -= PAD.speed;
      if (STATE.keys.down) STATE.right.vy += PAD.speed;
    }
  } else {
    STATE.right.y = 0;
  }

  // modo espejo
  if (STATE.mods.mirror) {
    STATE.left.vy *= -1;
    if (!STATE.aiRight) STATE.right.vy *= -1;
  }

  // mover palas
  STATE.left.y  += STATE.left.vy * dt;
  STATE.left.y  = Math.max(0, Math.min(STATE.h - PAD.h, STATE.left.y));
  if (!STATE.mods.giantAI) {
    STATE.right.y += STATE.right.vy * dt;
    STATE.right.y = Math.max(0, Math.min(STATE.h - PAD.h, STATE.right.y));
  } else {
    STATE.right.y = 0;
  }

  // actualizar pelotas
  for (const b of STATE.balls) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // rebote vertical
    if (b.y - b.r <= 0 && b.vy < 0) {
      b.y = b.r; b.vy *= -1; onBounce(b); blip();
    }
    if (b.y + b.r >= STATE.h && b.vy > 0) {
      b.y = STATE.h - b.r; b.vy *= -1; onBounce(b); blip();
    }

    // colisión paleta izquierda
    const lpX = PAD.margin, lpY = STATE.left.y;
    if (b.x - b.r <= lpX + PAD.w && b.x > lpX && b.y > lpY && b.y < lpY + PAD.h && b.vx < 0) {
      collideWithPaddle(b, 'left', lpY, PAD.h);
    }

    // colisión paleta derecha
    const rpX = STATE.w - PAD.margin - PAD.w, rpY = STATE.right.y, rpH = STATE.mods.giantAI ? STATE.h : PAD.h;
    if (b.x + b.r >= rpX && b.x < rpX + PAD.w && b.y > rpY && b.y < rpY + rpH && b.vx > 0) {
      collideWithPaddle(b, 'right', rpY, rpH);
    }
  }

  // puntos (se evalúan por pelota)
  for (const b of STATE.balls) {
    if (b.x < -b.r) {
      STATE.right.score++;
      updateScoreboard();
      if (checkWin()) return;
      resetBallInstance(b, +1); // saca hacia derecha
      blip(180);
    } else if (b.x > STATE.w + b.r) {
      STATE.left.score++;
      updateScoreboard();
      if (checkWin()) return;
      resetBallInstance(b, -1); // saca hacia izquierda
      blip(180);
    }
  }
}

function avgBallY() {
  if (STATE.balls.length === 0) return STATE.h/2;
  let s = 0; for (const b of STATE.balls) s += b.y;
  return s / STATE.balls.length;
}

function collideWithPaddle(b, side, padY, padH = PAD.h) {
  const rel = (b.y - (padY + padH/2)) / (padH/2); // -1..1
  const maxBounce = Math.PI/3; // 60º
  const ang = rel * maxBounce;
  const speed = Math.hypot(b.vx, b.vy) * 1.04; // leve aceleración por choque
  const dir = side === 'left' ? 1 : -1;

  b.vx = Math.cos(ang) * speed * dir;
  b.vy = Math.sin(ang) * speed;

  // separa de la pala
  if (side === 'left') b.x = PAD.margin + PAD.w + b.r + 0.1;
  else b.x = STATE.w - PAD.margin - PAD.w - b.r - 0.1;

  if (side === 'left') STATE.left.bounces++;
  else STATE.right.bounces++;
  updateBounceboard();
  checkParty();

  onBounce(b);
  blip(340);
}

function onBounce(b) {
  // MOD 1: +10% velocidad en cada bote
  if (STATE.mods.speedOnBounce) {
    const sp = Math.hypot(b.vx, b.vy) * 1.10;
    const ang = Math.atan2(b.vy, b.vx);
    // límite razonable
    const capped = Math.min(sp, b.baseSpeed * 3.0);
    b.vx = Math.cos(ang) * capped;
    b.vy = Math.sin(ang) * capped;
  }
  
  // MOD 2: 90% o 190% al azar en cada bote (límites 3–120 px)
  if (STATE.mods.sizeRandom) {
    let factor = Math.random() < 0.5 ? 0.9 : 1.9;
  
    // Si está muy pequeña, forzamos crecimiento; si está muy grande, forzamos reducir
    if (b.r < 5 && factor < 1) factor = 1.9;
    if (b.r > 100 && factor > 1) factor = 0.9;
  
    b.r = Math.max(3, Math.min(120, b.r * factor));
  }


}

function resetBallInstance(b, dirX = 1) {
  b.x = STATE.w / 2;
  b.y = STATE.h / 2;
  const angle = (Math.random() * 0.6 - 0.3);
  const speed = b.baseSpeed;
  b.vx = Math.cos(angle) * speed * dirX;
  b.vy = Math.sin(angle) * speed;
  b.r = 9; // resetea tamaño por si el mod 2 lo alteró mucho
}

function updateScoreboard() {
  scoreL.textContent = STATE.left.score;
  scoreR.textContent = STATE.right.score;
}

function updateBounceboard() {
  bounceL.textContent = STATE.left.bounces;
  bounceR.textContent = STATE.right.bounces;
}

function checkParty() {
  if (!STATE.party && STATE.left.bounces >= 50) {
    partyEl.classList.remove('hidden');
    STATE.party = true;
  }
}

function checkWin() {
  if (STATE.left.score >= STATE.targetScore || STATE.right.score >= STATE.targetScore) {
    const winner = STATE.left.score > STATE.right.score ? 'Jugador 1' : (STATE.aiRight ? 'IA' : 'Jugador 2');
    statusEl.textContent = `🏆 ¡${winner} gana! Pulsa R para reiniciar.`;
    STATE.paused = true;
    return true;
  }
  return false;
}

function loop(t) {
  const dt = Math.min(0.033, (t - STATE.t0) / 1000);
  STATE.t0 = t;
  update(dt);
  ctx.clearRect(0, 0, STATE.w, STATE.h);
  draw();
  requestAnimationFrame(loop);
}

// Eventos UI
modsBtn.addEventListener('click', () => {
  modsPanel.classList.toggle('hidden');
});

modSpeedEl.addEventListener('change', (e) => {
  STATE.mods.speedOnBounce = e.target.checked;
});

modSizeEl.addEventListener('change', (e) => {
  STATE.mods.sizeRandom = e.target.checked;
});

modTwoEl.addEventListener('change', (e) => {
  STATE.mods.twoBalls = e.target.checked;
  // activar/desactivar segunda pelota en caliente
  if (STATE.mods.twoBalls) {
    if (STATE.balls.length < 2) {
      const d = STATE.balls[0].vx > 0 ? -1 : 1;
      STATE.balls.push(createBall(d));
    }
  } else {
    // deja solo la primera
    if (STATE.balls.length > 1) STATE.balls.splice(1);
  }
});

modGiantEl.addEventListener('change', (e) => {
  STATE.mods.giantAI = e.target.checked;
  if (STATE.mods.giantAI) {
    STATE.aiRight = true;
    STATE.right.y = 0;
  } else {
    STATE.right.y = (STATE.h - PAD.h) / 2;
  }
});

modMirrorEl.addEventListener('change', (e) => {
  STATE.mods.mirror = e.target.checked;
});

// Controles teclado
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.key === 'w' || e.key === 'W') STATE.keys.w = true;
  if (e.key === 's' || e.key === 'S') STATE.keys.s = true;
  if (e.key === 'ArrowUp') STATE.keys.up = true;
  if (e.key === 'ArrowDown') STATE.keys.down = true;
  if (e.key === 'p' || e.key === 'P') {
    STATE.paused = !STATE.paused;
    statusEl.textContent = STATE.paused ? '⏸ Pausa (P para reanudar)' : '';
  }
  if (e.key === 'a' || e.key === 'A') {
    STATE.aiRight = !STATE.aiRight;
    statusEl.textContent = STATE.aiRight ? '🤖 IA activada para P2' : '👤 Control humano para P2';
  }
  if (e.key === 'r' || e.key === 'R') {
    STATE.left.score = 0; STATE.right.score = 0; updateScoreboard();
    STATE.left.bounces = 0; STATE.right.bounces = 0; updateBounceboard();
    STATE.paused = false; statusEl.textContent = '';
    STATE.party = false; partyEl.classList.add('hidden');
    centerEntities();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'w' || e.key === 'W') STATE.keys.w = false;
  if (e.key === 's' || e.key === 'S') STATE.keys.s = false;
  if (e.key === 'ArrowUp') STATE.keys.up = false;
  if (e.key === 'ArrowDown') STATE.keys.down = false;
});

window.addEventListener('resize', resize);

// Init
resize();
updateScoreboard();
updateBounceboard();
requestAnimationFrame(loop);
