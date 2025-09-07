// Pong con Mods (velocidad, tamaño, dos pelotas, pared IA + fiesta, modo espejo)
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

const scoreL = document.getElementById('scoreL');
const scoreR = document.getElementById('scoreR');
const bounceL = document.getElementById('bounceL');
const bounceR = document.getElementById('bounceR');
const statusEl = document.getElementById('status');

const modsBtn = document.getElementById('modsBtn');
const modsPanel = document.getElementById('modsPanel');
const modSpeedEl = document.getElementById('modSpeed');
const modSizeEl  = document.getElementById('modSize');
const modTwoEl   = document.getElementById('modTwo');
const modWallEl  = document.getElementById('modWall');
const modMirrorEl= document.getElementById('modMirror');

const STATE = {
  w: 0, h: 0,
  paused: false,
  aiRight: true,
  targetScore: 7,
  left:  { y: 0, vy: 0, score: 0, bounces: 0 },
  right: { y: 0, vy: 0, score: 0, bounces: 0 },
  balls: [],
  keys: { w:false, s:false, up:false, down:false },
  t0: performance.now(),
  mods: {
    speedOnBounce: false,   // +10% vel en cada bote
    sizeRandom: false,      // 90% o 190% tamaño al azar en cada bote
    twoBalls: false,        // dos pelotas
    wallMode: false,        // pala derecha ocupa toda la portería (pared)
    mirrorControls: false   // controles invertidos
  },
  sessionBounces: 0,
  celebrating: false
};

// Palas (usamos altura dinámica por lado)
const PAD = { w: 12, baseH: 120, margin: 20, speed: 580 };
const NET = { gap: 14 };

function padH(side) {
  if (side === 'right' && STATE.mods.wallMode) return STATE.h; // pared ocupa todo
  return PAD.baseH;
}

function createBall(dirX = 1) {
  const r = 9;
  const speed = 420; // un poco más vivo
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

  PAD.baseH = Math.max(60, Math.floor(cssH * 0.22));
  PAD.w     = Math.max(10, Math.floor(cssW * 0.012));
  PAD.margin= Math.max(10, Math.floor(cssW * 0.02));
  NET.gap   = 14;

  centerEntities();
}

function centerEntities() {
  STATE.left.y  = (STATE.h - padH('left')) / 2;
  STATE.right.y = STATE.mods.wallMode ? 0 : (STATE.h - padH('right')) / 2;

  // Re-crear pelotas según el mod activo
  STATE.balls = [ createBall(Math.random() < 0.5 ? -1 : 1) ];
  if (STATE.mods.twoBalls) {
    STATE.balls.push(createBall(STATE.balls[0].vx > 0 ? -1 : 1));
  }
}

// Sonidito generativo (WebAudio) — versión segura
let audioCtxGlobal = null;
function blip(freq = 260) {
  try {
    if (!audioCtxGlobal) {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtxGlobal = new AC();
    }
    const o = audioCtxGlobal.createOscillator();
    const g = audioCtxGlobal.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    g.gain.value = 0.03; // un poco más alto
    g.connect(audioCtxGlobal.destination);
    o.connect(g);
    o.start();
    o.stop(audioCtxGlobal.currentTime + 0.08);
  } catch (e) {
    console.warn("Audio desactivado:", e.message);
  }
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
  const hL = padH('left'), hR = padH('right');
  ctx.fillStyle = '#eaf2ff';
  ctx.fillRect(PAD.margin, STATE.left.y, PAD.w, hL);
  ctx.fillRect(STATE.w - PAD.margin - PAD.w, STATE.right.y, PAD.w, hR);

  // pelotas
  for (const b of STATE.balls) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
    ctx.fill();
  }

  // sombra sutil
  ctx.globalAlpha = 0.08;
  ctx.fillRect(PAD.margin+2, STATE.left.y+2, PAD.w, hL);
  ctx.fillRect(STATE.w - PAD.margin - PAD.w + 2, STATE.right.y + 2, PAD.w, hR);
  ctx.globalAlpha = 1;
}

function update(dt) {
  if (STATE.paused) return;

  const hL = padH('left'), hR = padH('right');

  // entrada P1
  let leftVy = 0;
  if (STATE.keys.w) leftVy -= PAD.speed;
  if (STATE.keys.s) leftVy += PAD.speed;
  if (STATE.mods.mirrorControls) leftVy *= -1;
  STATE.left.vy = leftVy;

  // P2 o IA
  let rightVy = 0;
  if (STATE.aiRight) {
    const target = avgBallY() - hR/2;
    const diff = target - STATE.right.y;
    const max = PAD.speed * (STATE.mods.wallMode ? 1.0 : 0.85);
    rightVy = Math.max(-max, Math.min(max, diff * 6));
  } else {
    if (STATE.keys.up)   rightVy -= PAD.speed;
    if (STATE.keys.down) rightVy += PAD.speed;
    if (STATE.mods.mirrorControls) rightVy *= -1;
  }
  STATE.right.vy = rightVy;

  // mover palas
  STATE.left.y  += STATE.left.vy * dt;
  STATE.right.y += STATE.right.vy * dt;

  // límites
  STATE.left.y  = Math.max(0, Math.min(STATE.h - hL, STATE.left.y));
  STATE.right.y = STATE.mods.wallMode ? 0 : Math.max(0, Math.min(STATE.h - hR, STATE.right.y));

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
    if (b.x - b.r <= lpX + PAD.w && b.x > lpX && b.y > lpY && b.y < lpY + hL && b.vx < 0) {
      collideWithPaddle(b, 'left', lpY, hL);
    }

    // colisión paleta derecha
    const rpX = STATE.w - PAD.margin - PAD.w, rpY = STATE.right.y;
    if (b.x + b.r >= rpX && b.x < rpX + PAD.w && b.y > rpY && b.y < rpY + hR && b.vx > 0) {
      collideWithPaddle(b, 'right', rpY, hR);
    }
  }

  // puntos por pelota
  for (const b of STATE.balls) {
    if (b.x < -b.r) {
      STATE.right.score++;
      updateScoreboard();
      if (checkWin()) return;
      resetBallInstance(b, +1);
      blip(180);
    } else if (b.x > STATE.w + b.r) {
      STATE.left.score++;
      updateScoreboard();
      if (checkWin()) return;
      resetBallInstance(b, -1);
      blip(180);
    }
  }
}

function avgBallY() {
  if (STATE.balls.length === 0) return STATE.h/2;
  let s = 0; for (const b of STATE.balls) s += b.y;
  return s / STATE.balls.length;
}

function collideWithPaddle(b, side, padY, hPad) {
  const rel = (b.y - (padY + hPad/2)) / (hPad/2); // -1..1
  const maxBounce = Math.PI/3; // 60º
  const ang = rel * maxBounce;
  const speed = Math.hypot(b.vx, b.vy) * 1.06; // un pelín más de punch
  const dir = side === 'left' ? 1 : -1;

  b.vx = Math.cos(ang) * speed * dir;
  b.vy = Math.sin(ang) * speed;

  // separa de la pala
  if (side === 'left') b.x = PAD.margin + PAD.w + b.r + 0.1;
  else b.x = STATE.w - PAD.margin - PAD.w - b.r - 0.1;

  if (side === 'left') STATE.left.bounces++;
  else STATE.right.bounces++;
  STATE.sessionBounces++;
  updateBounceboard();

  // Fiesta al llegar a 50 botes en modo pared
  if (STATE.mods.wallMode && !STATE.celebrating && STATE.sessionBounces >= 50) {
    celebrate();
  }

  onBounce(b);
  blip(340);
}

function onBounce(b) {
  // MOD 1: +10% velocidad en cada bote (cap a 3x)
  if (STATE.mods.speedOnBounce) {
    const sp = Math.hypot(b.vx, b.vy) * 1.10;
    const ang = Math.atan2(b.vy, b.vx);
    const capped = Math.min(sp, b.baseSpeed * 3.0);
    b.vx = Math.cos(ang) * capped;
    b.vy = Math.sin(ang) * capped;
  }

  // MOD 2: 90% o 190% al azar en cada bote (límites amplios)
  if (STATE.mods.sizeRandom) {
    let factor = Math.random() < 0.5 ? 0.9 : 1.9;
    if (b.r < 5 && factor < 1) factor = 1.9;  // corrige encadenados
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
  b.r = 9;
}

function updateScoreboard() {
  scoreL.textContent = STATE.left.score;
  scoreR.textContent = STATE.right.score;
}

function updateBounceboard() {
  bounceL.textContent = STATE.left.bounces;
  bounceR.textContent = STATE.right.bounces;
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
  if (STATE.mods.twoBalls) {
    if (STATE.balls.length < 2) {
      const d = STATE.balls[0].vx > 0 ? -1 : 1;
      STATE.balls.push(createBall(d));
    }
  } else {
    if (STATE.balls.length > 1) STATE.balls.splice(1);
  }
});

modWallEl.addEventListener('change', (e) => {
  STATE.mods.wallMode = e.target.checked;
  STATE.aiRight = true;          // siempre con IA en modo pared
  STATE.sessionBounces = 0;
  STATE.right.bounces = 0;       // reinicia contadores pared
  STATE.left.bounces  = 0;
  updateBounceboard();
  centerEntities();
  statusEl.textContent = STATE.mods.wallMode ? '🧱 Modo pared activo: ¡haz 50 botes para fiesta!' : '';
});

modMirrorEl.addEventListener('change', (e) => {
  STATE.mods.mirrorControls = e.target.checked;
  statusEl.textContent = STATE.mods.mirrorControls ? '🪞 Controles invertidos' : '';
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
    STATE.sessionBounces = 0; STATE.paused = false; statusEl.textContent = '';
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

// --- Fiesta (overlay sencillo) ---
function celebrate() {
  STATE.celebrating = true;
  const div = document.createElement('div');
  div.className = 'celebrate';
  div.innerHTML = '<h1>🎉 ¡50 botes! 🎉</h1>';
  document.body.appendChild(div);
  setTimeout(() => {
    div.remove();
    STATE.celebrating = false;
    STATE.sessionBounces = 0; // reinicia la sesión para poder volver a celebrar
  }, 3000);
}
