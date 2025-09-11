// Pong con Mods (velocidad, tamaño, dos pelotas, pared IA + fiesta, modo espejo)
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

const scoreL = document.getElementById('scoreL');
const scoreR = document.getElementById('scoreR');
const bounceL = document.getElementById('bounceL');
const bounceR = document.getElementById('bounceR');
const statusEl = document.getElementById('status');

const modsBtn = document.getElementById('modsBtn');
const fsBtn   = document.getElementById('fsBtn');
const modsPanel = document.getElementById('modsPanel');
const modSpeedEl = document.getElementById('modSpeed');
const modSizeEl  = document.getElementById('modSize');
const modTwoEl   = document.getElementById('modTwo');
const modWallEl  = document.getElementById('modWall');
const modMirrorEl= document.getElementById('modMirror');
const modSpinEl   = document.getElementById('modSpin');
const modGravityEl= document.getElementById('modGravity');
const modTrailEl  = document.getElementById('modTrail');
const modTeleportEl = document.getElementById('modTeleport');
const aiDiffEl    = document.getElementById('aiDiff');
const aiDiffLabel = document.getElementById('aiDiffLabel');

const STATE = {
  w: 0, h: 0,
  paused: false,
  aiRight: true,
  aiDifficulty: 1.0,
  targetScore: 7,
  left:  { y: 0, vy: 0, score: 0, bounces: 0 },
  right: { y: 0, vy: 0, score: 0, bounces: 0 },
  balls: [],
  keys: { w:false, s:false, up:false, down:false },
  t0: performance.now(),
  audioMuted: false,
  touch: { leftId: null, rightId: null, leftY: null, rightY: null },
  mods: {
    speedOnBounce: false,   // +10% vel en cada bote
    sizeRandom: false,      // 90% o 190% tamaño al azar en cada bote
    twoBalls: false,        // dos pelotas
    wallMode: false,        // pala derecha ocupa toda la portería (pared)
    mirrorControls: false,   // controles invertidos
    spinOnHit: false,      // 6) añadir efecto de corte al golpear
    gravity: false,        // 7) gravedad hacia abajo
    trail: false,          // 8) estela visual
    teleportOnWall: false  // 9) teletransporte en rebote de pared

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
  const speed = 420; // vivo
  const angle = (Math.random() * 0.6 - 0.3);
  return {
    x: STATE.w / 2,
    y: STATE.h / 2,
    vx: Math.cos(angle) * speed * dirX,
    vy: Math.sin(angle) * speed,
    r,
    baseSpeed: speed,
    trail: [] // para el mod de estela
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
  saveSettings();
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
  if (STATE.audioMuted) return;
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

  // pelotas + estela
  for (const b of STATE.balls) {
    if (STATE.mods.trail && b.trail.length > 1) {
      ctx.save();
      for (let i = 0; i < b.trail.length; i++) {
        const t = b.trail[i];
        const alpha = i / b.trail.length * 0.35; // de tenue a menos tenue
        ctx.fillStyle = `rgba(234,242,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, Math.max(2, t.r * 0.9), 0, Math.PI*2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.fillStyle = '#eaf2ff';
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
    const max = PAD.speed * (STATE.mods.wallMode ? 1.0 : 0.85) * STATE.aiDifficulty;
    const response = 6 * (0.85 + (STATE.aiDifficulty - 1) * 0.5);
    rightVy = Math.max(-max, Math.min(max, diff * response));
  } else {
    if (STATE.keys.up)   rightVy -= PAD.speed;
    if (STATE.keys.down) rightVy += PAD.speed;
    if (STATE.mods.mirrorControls) rightVy *= -1;
  }
  STATE.right.vy = rightVy;

  // mover palas
  STATE.left.y  += STATE.left.vy * dt;
  STATE.right.y += STATE.right.vy * dt;

  // Control por tacto (si hay objetivo de dedo, domina)
  if (STATE.touch.leftY != null) {
    STATE.left.y = Math.max(0, Math.min(STATE.h - hL, STATE.touch.leftY - hL/2));
  }
  if (!STATE.aiRight && STATE.touch.rightY != null) {
    STATE.right.y = Math.max(0, Math.min(STATE.h - hR, STATE.touch.rightY - hR/2));
  }

  // límites
  STATE.left.y  = Math.max(0, Math.min(STATE.h - hL, STATE.left.y));
  STATE.right.y = STATE.mods.wallMode ? 0 : Math.max(0, Math.min(STATE.h - hR, STATE.right.y));

  // actualizar pelotas
  for (const b of STATE.balls) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    // 7) Gravedad
    if (STATE.mods.gravity) {
    const G = 900; // px/s^2 (ajustable)
    b.vy += G * dt;
}

// 8) Estela (guardamos historial de posiciones)
if (STATE.mods.trail) {
  b.trail.push({x: b.x, y: b.y, r: b.r});
  if (b.trail.length > 14) b.trail.shift();
} else {
  b.trail.length = 0;
}


    // rebote vertical
    if (b.y - b.r <= 0 && b.vy < 0) {
      b.y = b.r; b.vy *= -1; onBounce(b); blip();
      if (STATE.mods.teleportOnWall) teleportAwayFromPaddles(b);
    }
    if (b.y + b.r >= STATE.h && b.vy > 0) {
      b.y = STATE.h - b.r; b.vy *= -1; onBounce(b); blip();
      if (STATE.mods.teleportOnWall) teleportAwayFromPaddles(b);
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
  // 6) Spin: añade componente vertical según velocidad de la pala
if (STATE.mods.spinOnHit) {
  const padVy = (side === 'left') ? STATE.left.vy : STATE.right.vy;
  b.vy += padVy * 0.15; // factor de corte (ajustable)
  // Cap velocidad total para que no explote
  const v = Math.hypot(b.vx, b.vy);
  const vmax = b.baseSpeed * 3.2;
  if (v > vmax) {
    const k = vmax / v;
    b.vx *= k; b.vy *= k;
  }
}

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

// Teletransporta la pelota a una posición aleatoria que no esté
// demasiado cerca de las raquetas ni de los bordes superior/inferior.
function teleportAwayFromPaddles(b) {
  const safeFromTop = Math.max(20, b.r + 10);
  const safeFromBottom = Math.max(20, b.r + 10);
  const xLeftEdge = PAD.margin + PAD.w;
  const xRightEdge = STATE.w - PAD.margin - PAD.w;
  const safePad = 120; // distancia mínima horizontal respecto a cada raqueta

  // Rango horizontal permitido: lejos de ambas palas
  const minX = xLeftEdge + safePad;
  const maxX = xRightEdge - safePad;
  if (maxX <= minX) return; // campo estrecho: no teletransportar

  // Muestrea algunas posiciones hasta encontrar una válida
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * (maxX - minX) + minX;
    const y = Math.random() * (STATE.h - safeFromTop - safeFromBottom) + safeFromTop;
    // validar distancia a las palas en vertical también (centro vs rangos)
    const hL = padH('left');
    const hR = padH('right');
    const leftRect = { x: PAD.margin, y: STATE.left.y, w: PAD.w, h: hL };
    const rightRect= { x: STATE.w - PAD.margin - PAD.w, y: STATE.right.y, w: PAD.w, h: hR };

    const farFromLeft = (x > leftRect.x + leftRect.w + 60) || (y < leftRect.y - 40) || (y > leftRect.y + leftRect.h + 40);
    const farFromRight= (x < rightRect.x - 60) || (y < rightRect.y - 40) || (y > rightRect.y + rightRect.h + 40);
    if (farFromLeft && farFromRight) {
      b.x = x; b.y = y;
      return;
    }
  }
  // en último recurso, centra
  b.x = STATE.w / 2; b.y = STATE.h / 2;
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

// Arregla textos con mala codificación presentes en el HTML original
function fixEncodingArtifacts() {
  try {
    document.querySelectorAll('.dash').forEach(el => { el.textContent = '—'; });

    const sizeParent = document.getElementById('modSize')?.parentElement;
    if (sizeParent) {
      sizeParent.innerHTML = '<input type="checkbox" id="modSize"> 2) La bola cambia ±90% de tamaño al azar en cada bote';
      const sizeEl = document.getElementById('modSize');
      sizeEl.addEventListener('change', (e) => { STATE.mods.sizeRandom = e.target.checked; });
    }

    const spinParent = document.getElementById('modSpin')?.parentElement;
    if (spinParent) {
      spinParent.innerHTML = '<input type="checkbox" id="modSpin"> 6) Spin: la pala "corta" la pelota al golpear';
      const spinEl = document.getElementById('modSpin');
      spinEl.addEventListener('change', (e) => { STATE.mods.spinOnHit = e.target.checked; });
    }
  } catch {}
}

// Utilidades y persistencia
function fixEncodingArtifactsSafe() { try { document.querySelectorAll('.dash').forEach(el => { el.textContent = '-'; }); } catch {} }

const LS_KEY = 'mongpong_settings_v1';
function saveSettings() {
  try {
    const data = { mods: { ...STATE.mods }, aiRight: STATE.aiRight, audioMuted: STATE.audioMuted, aiDifficulty: STATE.aiDifficulty };
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {}
}
function loadSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.mods) Object.assign(STATE.mods, data.mods);
    if (typeof data.aiRight === 'boolean') STATE.aiRight = data.aiRight;
    if (typeof data.audioMuted === 'boolean') STATE.audioMuted = data.audioMuted;
    if (typeof data.aiDifficulty === 'number') STATE.aiDifficulty = data.aiDifficulty;
    // UI
    if (modSpeedEl)   modSpeedEl.checked   = !!STATE.mods.speedOnBounce;
    if (modSizeEl)    modSizeEl.checked    = !!STATE.mods.sizeRandom;
    if (modTwoEl)     modTwoEl.checked     = !!STATE.mods.twoBalls;
    if (modWallEl)    modWallEl.checked    = !!STATE.mods.wallMode;
    if (modMirrorEl)  modMirrorEl.checked  = !!STATE.mods.mirrorControls;
    if (modSpinEl)    modSpinEl.checked    = !!STATE.mods.spinOnHit;
    if (modGravityEl) modGravityEl.checked = !!STATE.mods.gravity;
    if (modTrailEl)   modTrailEl.checked   = !!STATE.mods.trail;
    if (modTeleportEl) modTeleportEl.checked = !!STATE.mods.teleportOnWall;
    if (aiDiffEl)     aiDiffEl.value = String(STATE.aiDifficulty);
    updateAiLabel();
    centerEntities();
  } catch {}
}
function updateAiLabel() {
  if (!aiDiffLabel || !aiDiffEl) return;
  const v = parseFloat(aiDiffEl.value);
  let txt = 'Normal';
  if (v <= 0.7) txt = 'Fácil';
  else if (v >= 1.4) txt = 'Difícil';
  aiDiffLabel.textContent = txt + ` (${v.toFixed(1)}x)`;
}

// Eventos UI
fixEncodingArtifactsSafe();
modsBtn.addEventListener('click', () => {
  modsPanel.classList.toggle('hidden');
});

if (fsBtn) {
  fsBtn.addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {}
  });
}

modSpeedEl.addEventListener('change', (e) => {
  STATE.mods.speedOnBounce = e.target.checked;
  saveSettings();
});

modSizeEl.addEventListener('change', (e) => {
  STATE.mods.sizeRandom = e.target.checked;
  saveSettings();
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
  saveSettings();
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

modSpinEl.addEventListener('change', (e) => {
  STATE.mods.spinOnHit = e.target.checked;
});
modGravityEl.addEventListener('change', (e) => {
  STATE.mods.gravity = e.target.checked;
});
modTrailEl.addEventListener('change', (e) => {
  STATE.mods.trail = e.target.checked;
});

if (modTeleportEl) {
  modTeleportEl.addEventListener('change', (e) => {
    STATE.mods.teleportOnWall = e.target.checked;
    saveSettings();
  });
}

// Control deslizante de dificultad de IA
if (aiDiffEl) {
  aiDiffEl.addEventListener('input', (e) => {
    STATE.aiDifficulty = parseFloat(e.target.value);
    updateAiLabel();
    saveSettings();
  });
}

// Controles teclado
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.key === 'w' || e.key === 'W') STATE.keys.w = true;
  if (e.key === 's' || e.key === 'S') STATE.keys.s = true;
  if (e.key === 'ArrowUp') STATE.keys.up = true;
  if (e.key === 'ArrowDown') STATE.keys.down = true;
  if (e.key === 'm' || e.key === 'M') {
    STATE.audioMuted = !STATE.audioMuted;
    statusEl.textContent = STATE.audioMuted ? '🔈 Sonido silenciado' : '';
  }
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
  if (e.key === 'm' || e.key === 'M' || e.key === 'a' || e.key === 'A') saveSettings();
});

window.addEventListener('resize', resize);

// Init
loadSettings();
updateAiLabel();
resize();
updateScoreboard();
updateBounceboard();
requestAnimationFrame(loop);

// Controles táctiles (Pointer Events)
function canvasPointFromEvent(e){
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  return { x, y };
}

canvas.addEventListener('pointerdown', (e) => {
  const { x, y } = canvasPointFromEvent(e);
  const leftSide = x < STATE.w / 2;
  if (leftSide) {
    STATE.touch.leftId = e.pointerId;
    STATE.touch.leftY = y;
  } else if (!STATE.aiRight) {
    STATE.touch.rightId = e.pointerId;
    STATE.touch.rightY = y;
  }
  try { canvas.setPointerCapture(e.pointerId); } catch {}
});

canvas.addEventListener('pointermove', (e) => {
  if (STATE.touch.leftId !== e.pointerId && STATE.touch.rightId !== e.pointerId) return;
  const { y } = canvasPointFromEvent(e);
  if (STATE.touch.leftId === e.pointerId) STATE.touch.leftY = y;
  if (STATE.touch.rightId === e.pointerId) STATE.touch.rightY = y;
});

function releasePointer(e){
  if (STATE.touch.leftId === e.pointerId) {
    STATE.touch.leftId = null; STATE.touch.leftY = null;
  }
  if (STATE.touch.rightId === e.pointerId) {
    STATE.touch.rightId = null; STATE.touch.rightY = null;
  }
  try { canvas.releasePointerCapture(e.pointerId); } catch {}
}
canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);
canvas.addEventListener('pointerleave', releasePointer);

// UI dinámica: botón mute y pista táctil junto a controles
(function setupExtraUI(){
  try {
    const controls = document.querySelector('.controls');
    if (controls && !document.getElementById('touchHint')) {
      const hint = document.createElement('span');
      hint.id = 'touchHint';
      hint.style.marginLeft = '8px';
      hint.style.opacity = '0.85';
      const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
      if (isTouch) hint.textContent = '· Táctil: arrastra en cada lado';
      controls.appendChild(hint);
    }
  } catch {}

  try {
    const panel = document.getElementById('modsPanel');
    if (panel && !document.getElementById('muteBtn')) {
      const wrap = document.createElement('div');
      wrap.style.marginTop = '8px';
      const btn = document.createElement('button');
      btn.id = 'muteBtn';
      btn.className = 'btn';
      btn.setAttribute('aria-pressed', 'false');
      btn.textContent = '🔊 Sonido';
      btn.addEventListener('click', () => {
        STATE.audioMuted = !STATE.audioMuted;
        btn.setAttribute('aria-pressed', String(STATE.audioMuted));
        btn.textContent = STATE.audioMuted ? '🔈 Silenciado' : '🔊 Sonido';
      });
      wrap.appendChild(btn);
      // Checkbox mod: teletransporte en rebote de pared
      let teleCb = document.getElementById('modTeleport');
      if (!teleCb) {
        const teleLbl = document.createElement('label');
        teleLbl.style.display = 'block';
        teleCb = document.createElement('input');
        teleCb.type = 'checkbox';
        teleCb.id = 'modTeleport';
        teleLbl.appendChild(teleCb);
        teleLbl.appendChild(document.createTextNode(' 9) Teletransporte al rebotar en pared'));
        panel.appendChild(teleLbl);
      }
      if (teleCb) {
        teleCb.addEventListener('change', (e) => {
          STATE.mods.teleportOnWall = e.target.checked;
        });
      }
      panel.appendChild(wrap);
    }
  } catch {}
})();

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
