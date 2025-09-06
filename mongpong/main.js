// Pong en Canvas — compacto y listo para clase
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

const scoreL = document.getElementById('scoreL');
const scoreR = document.getElementById('scoreR');
const statusEl = document.getElementById('status');

const STATE = {
  w: 0, h: 0,
  paused: false,
  aiRight: true,
  targetScore: 7,
  left: { y: 0, vy: 0, score: 0 },
  right:{ y: 0, vy: 0, score: 0 },
  ball: { x: 0, y: 0, vx: 0, vy: 0, r: 9, speed: 380 },
  keys: { w:false, s:false, up:false, down:false },
  t0: performance.now(), acc: 0
};

function resize() {
  // Mantener un lienzo nítido en alta densidad de píxeles
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  canvas.width  = cssW * dpr;
  canvas.height = cssH * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  STATE.w = cssW; STATE.h = cssH;

  // Medidas dependientes del tamaño
  PAD.h = Math.max(60, Math.floor(cssH * 0.22));
  PAD.w = Math.max(10, Math.floor(cssW * 0.012));
  PAD.margin = Math.max(10, Math.floor(cssW * 0.02));
  NET.gap = 14;

  // Reposicionar si es primera carga o tras punto
  centerEntities();
}

const PAD = { w: 12, h: 120, margin: 20, speed: 520 };
const NET = { gap: 14 };

function centerEntities() {
  STATE.left.y  = (STATE.h - PAD.h) / 2;
  STATE.right.y = (STATE.h - PAD.h) / 2;
  resetBall();
}

function resetBall(scoredToLeft = null) {
  const b = STATE.ball;
  b.x = STATE.w / 2;
  b.y = STATE.h / 2;

  // Dirección inicial: hacia quien recibió el punto en la última jugada
  let dirX;
  if (scoredToLeft === true) dirX = -1;
  else if (scoredToLeft === false) dirX = 1;
  else dirX = Math.random() < 0.5 ? -1 : 1;

  const angle = (Math.random() * 0.6 - 0.3); // +- ~17º
  const speed = b.speed;
  b.vx = Math.cos(angle) * speed * dirX;
  b.vy = Math.sin(angle) * speed;
}

function draw() {
  // Fondo ya lo da el CSS; aquí pintamos elementos del juego
  // Red central
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

  // Palas
  ctx.fillStyle = '#eaf2ff';
  ctx.fillRect(PAD.margin, STATE.left.y, PAD.w, PAD.h);
  ctx.fillRect(STATE.w - PAD.margin - PAD.w, STATE.right.y, PAD.w, PAD.h);

  // Pelota
  ctx.beginPath();
  ctx.arc(STATE.ball.x, STATE.ball.y, STATE.ball.r, 0, Math.PI*2);
  ctx.fill();

  // Sombra sutil
  ctx.globalAlpha = 0.08;
  ctx.fillRect(PAD.margin+2, STATE.left.y+2, PAD.w, PAD.h);
  ctx.fillRect(STATE.w - PAD.margin - PAD.w + 2, STATE.right.y + 2, PAD.w, PAD.h);
  ctx.globalAlpha = 1;
}

function update(dt) {
  if (STATE.paused) return;

  // Entrada jugador 1 (W/S)
  STATE.left.vy = 0;
  if (STATE.keys.w) STATE.left.vy -= PAD.speed;
  if (STATE.keys.s) STATE.left.vy += PAD.speed;

  // Entrada jugador 2 (↑/↓) o IA
  STATE.right.vy = 0;
  if (STATE.aiRight) {
    // IA simple: sigue la pelota con límite de velocidad
    const target = STATE.ball.y - PAD.h/2;
    const diff = target - STATE.right.y;
    const max = PAD.speed * 0.85;
    STATE.right.vy = Math.max(-max, Math.min(max, diff * 6)); // proporcional
  } else {
    if (STATE.keys.up)   STATE.right.vy -= PAD.speed;
    if (STATE.keys.down) STATE.right.vy += PAD.speed;
  }

  // Actualizar posiciones de palas
  STATE.left.y  += STATE.left.vy * dt;
  STATE.right.y += STATE.right.vy * dt;

  // Limitar dentro del canvas
  STATE.left.y  = Math.max(0, Math.min(STATE.h - PAD.h, STATE.left.y));
  STATE.right.y = Math.max(0, Math.min(STATE.h - PAD.h, STATE.right.y));

  // Pelota
  const b = STATE.ball;
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  // Rebote vertical
  if (b.y - b.r <= 0 && b.vy < 0) { b.y = b.r; b.vy *= -1; blip(); }
  if (b.y + b.r >= STATE.h && b.vy > 0) { b.y = STATE.h - b.r; b.vy *= -1; blip(); }

  // Colisión con palas
  // Izquierda
  const lpX = PAD.margin, lpY = STATE.left.y;
  if (b.x - b.r <= lpX + PAD.w && b.x > lpX && b.y > lpY && b.y < lpY + PAD.h && b.vx < 0) {
    collideWithPaddle('left', lpY);
  }
  // Derecha
  const rpX = STATE.w - PAD.margin - PAD.w, rpY = STATE.right.y;
  if (b.x + b.r >= rpX && b.x < rpX + PAD.w && b.y > rpY && b.y < rpY + PAD.h && b.vx > 0) {
    collideWithPaddle('right', rpY);
  }

  // Puntos
  if (b.x < -b.r) {
    // Punto para derecha
    STATE.right.score++;
    updateScoreboard();
    if (checkWin()) return;
    resetBall(false);
    blip(180);
  } else if (b.x > STATE.w + b.r) {
    // Punto para izquierda
    STATE.left.score++;
    updateScoreboard();
    if (checkWin()) return;
    resetBall(true);
    blip(180);
  }
}

function collideWithPaddle(side, padY) {
  const b = STATE.ball;
  const rel = (b.y - (padY + PAD.h/2)) / (PAD.h/2); // -1..1
  const maxBounce = Math.PI/3; // 60º
  const ang = rel * maxBounce;
  const speed = Math.hypot(b.vx, b.vy) * 1.04; // leve aceleración

  const dir = side === 'left' ? 1 : -1;
  b.vx = Math.cos(ang) * speed * dir;
  b.vy = Math.sin(ang) * speed;

  // Empujar fuera de la pala para evitar pegado
  if (side === 'left') b.x = PAD.margin + PAD.w + b.r + 0.1;
  else b.x = STATE.w - PAD.margin - PAD.w - b.r - 0.1;

  blip(340);
}

function updateScoreboard() {
  scoreL.textContent = STATE.left.score;
  scoreR.textContent = STATE.right.score;
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

// Sonidito generativo (WebAudio simple)
let audioCtx;
function blip(freq = 260) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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

// Bucle principal
function loop(t) {
  const dt = Math.min(0.033, (t - STATE.t0) / 1000); // máx 33ms
  STATE.t0 = t;
  update(dt);
  // Limpiar frame
  ctx.clearRect(0, 0, STATE.w, STATE.h);
  draw();
  requestAnimationFrame(loop);
}

// Controles
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
    STATE.paused = false; statusEl.textContent = '';
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

// Inicializar
resize();
requestAnimationFrame(loop);
