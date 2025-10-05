// Simple image/label matching game engine (Signs)

const board = document.getElementById('board');
const resetBtn = document.getElementById('resetBtn');
const statusEl = document.getElementById('status');
const winsEl = document.getElementById('wins');
const achievementsBtn = document.getElementById('achievementsBtn');
const achievementsClose = document.getElementById('achievementsClose');
const achievementsOverlay = document.getElementById('achievementsOverlay');
const achievementsList = document.getElementById('achievementsList');
const resetProgressBtn = document.getElementById('resetProgressBtn');

const MEDAL_THRESHOLDS = { bronze: 10, silver: 20, gold: 30 };
const ACHIEVEMENTS = [
  { key: 'bronze',   title: 'Medalla de bronce',  desc: 'Gana 10 partidas', icon: 'assets/medals/bronze.svg', type: 'wins', threshold: 10 },
  { key: 'silver',   title: 'Medalla de plata',   desc: 'Gana 20 partidas', icon: 'assets/medals/silver.svg', type: 'wins', threshold: 20 },
  { key: 'gold',     title: 'Medalla de oro',     desc: 'Gana 30 partidas', icon: 'assets/medals/gold.svg',   type: 'wins', threshold: 30 },
  { key: 'explorer', title: 'Medalla de explorador', desc: 'Empareja todas las señales', icon: 'assets/medals/explorer.svg', type: 'explorer' }
];
let ALL_ITEMS = [];

function loadWins() { return parseInt(localStorage.getItem('sm_wins') || '0', 10); }
function saveWins(n) { localStorage.setItem('sm_wins', String(n)); }
function loadSeen() { try { return new Set(JSON.parse(localStorage.getItem('sm_seen') || '[]')); } catch { return new Set(); } }
function saveSeen(set) { localStorage.setItem('sm_seen', JSON.stringify(Array.from(set))); }
function loadMedals() {
  try {
    const raw = JSON.parse(localStorage.getItem('sm_medals') || '{}');
    const norm = {};
    for (const k of Object.keys(raw)) {
      const v = raw[k];
      norm[k] = typeof v === 'boolean' ? (v ? { unlocked: true } : { unlocked: false }) : v;
    }
    return norm;
  } catch { return {}; }
}
function saveMedals(obj) { localStorage.setItem('sm_medals', JSON.stringify(obj)); }
function updateWinsUI() { const w = loadWins(); if (winsEl) winsEl.textContent = `Victorias: ${w}`; }
function updateMedalsUI() {
  const medals = loadMedals();
  document.querySelectorAll('.medal').forEach(m => {
    const k = m.getAttribute('data-medal');
    if (medals[k] && medals[k].unlocked) m.classList.add('earned'); else m.classList.remove('earned');
  });
}

function formatDate(d) { try { return new Date(d).toLocaleString(); } catch { return String(d); } }

function renderAchievementsPanel() {
  const wins = loadWins();
  const medals = loadMedals();
  const seen = loadSeen();
  const withImages = ALL_ITEMS.filter(it => it && it.image).map(it => it.id);
  const totalSet = new Set(withImages);
  const total = totalSet.size;
  const seenCount = Array.from(new Set(Array.from(seen).filter(id => totalSet.has(id)))).length;

  const rows = ACHIEVEMENTS.map(a => {
    let status = 'No obtenida';
    let date = '';
    if (medals[a.key]?.unlocked) {
      status = 'Obtenida';
      if (medals[a.key]?.at) date = ` · ${formatDate(medals[a.key].at)}`;
    } else if (a.type === 'wins') {
      status = `Progreso: ${Math.min(wins, a.threshold)}/${a.threshold}`;
    } else if (a.type === 'explorer') {
      status = `Progreso: ${seenCount}/${total}`;
    }
    return `
      <div class="ach">
        <div class="icon"><img src="${a.icon}" alt="${a.title}" /></div>
        <div class="meta">
          <div class="title">${a.title}</div>
          <div class="desc">${a.desc}</div>
          <div class="date">${status}${date}</div>
        </div>
      </div>`;
  });
  achievementsList.innerHTML = rows.join('\n');
}

// Prefer inline data (items.js) when opened from file://
async function loadData() {
  if (window.ITEMS && Array.isArray(window.ITEMS)) return window.ITEMS;
  try {
    const res = await fetch('data/items.json');
    if (!res.ok) throw new Error('No se pudo cargar data/items.json');
    return await res.json();
  } catch (e) {
    console.warn('Fallo al cargar items.json. Usando demo local.', e);
    return [
      { id: 'sign_generic', label: 'Señal', image: '' },
      { id: 'sign_other', label: 'Señal 2', image: '' }
    ];
  }
}

function buildDeck(items) {
  const deck = [];
  items.forEach((it) => {
    const base = { id: it.id };
    if (it.image) {
      deck.push({ ...base, type: 'img', image: it.image });
      deck.push({ ...base, type: 'label', label: it.label || it.id });
    } else {
      deck.push({ ...base, type: 'label', label: (it.label || it.id) + ' (A)' });
      deck.push({ ...base, type: 'label', label: (it.label || it.id) + ' (B)' });
    }
  });
  return shuffle(deck);
}

function shuffle(arr) { const a = arr.slice(); for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }

function createCard(cardDef, index, onReveal) {
  const card = document.createElement('button');
  card.className = 'card';
  card.setAttribute('data-id', cardDef.id);
  card.setAttribute('data-type', cardDef.type);
  card.setAttribute('aria-label', 'Carta oculta');

  const back = document.createElement('div');
  back.className = 'face back';
  back.innerHTML = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3L1 9l11 6 9-4.909V17h2V9L12 3z" fill="currentColor" opacity=".25"/></svg>';

  const front = document.createElement('div');
  front.className = 'face front';

  if (cardDef.type === 'img' && cardDef.image) {
    const img = document.createElement('div');
    img.className = 'img';
    img.style.backgroundImage = `url("${cardDef.image}")`;
    front.appendChild(img);
    card.setAttribute('aria-description', 'Imagen');
  } else {
    const lab = document.createElement('div');
    lab.className = 'label';
    lab.textContent = cardDef.label || cardDef.id;
    front.appendChild(lab);
    card.setAttribute('aria-description', 'Etiqueta de texto');
  }

  card.appendChild(back);
  card.appendChild(front);
  card.addEventListener('click', () => {
    if (card.classList.contains('revealed') || card.classList.contains('match')) return;
    onReveal(card, cardDef);
  });
  return card;
}

function renderBoard(deck) {
  board.innerHTML = '';
  const state = { first: null, second: null, busy: false, matched: 0, totalPairs: deck.length / 2 };
  const onReveal = (el, def) => {
    if (state.busy) return;
    el.classList.add('revealed');
    if (!state.first) { state.first = { el, def }; return; }
    state.second = { el, def }; state.busy = true;
    const isMatch = state.first.def.id === state.second.def.id && state.first.def.type !== state.second.def.type;
    if (isMatch) {
      [state.first.el, state.second.el].forEach((c) => c.classList.add('match'));
      state.matched += 1;
      announce(`${state.matched}/${state.totalPairs} parejas`);
      resetPick(state);
      if (state.matched === state.totalPairs) { announce('Completado!'); onWin(deck); }
    } else {
      [state.first.el, state.second.el].forEach((c) => c.classList.add('fail'));
      setTimeout(() => { [state.first.el, state.second.el].forEach((c) => { c.classList.remove('revealed', 'fail'); }); resetPick(state); }, 750);
    }
  };
  deck.forEach((d, i) => board.appendChild(createCard(d, i, onReveal)));
}

function resetPick(state) { state.first = null; state.second = null; state.busy = false; }
function announce(msg) { statusEl.textContent = msg; }

async function init() {
  const items = await loadData();
  ALL_ITEMS = items.slice();
  const PAIRS = 5;
  const withImages = items.filter(it => it && it.image);
  const chosen = shuffle(withImages).slice(0, Math.min(PAIRS, withImages.length));
  const deck = buildDeck(chosen);
  renderBoard(deck);
  updateWinsUI();
  updateMedalsUI();
}

function onWin(deck) {
  let wins = loadWins(); wins += 1; saveWins(wins); updateWinsUI();
  const seen = loadSeen(); const idsInRound = new Set(deck.map(d => d.id)); idsInRound.forEach(id => seen.add(id)); saveSeen(seen);
  const medals = loadMedals(); const now = new Date().toISOString();
  if (wins >= MEDAL_THRESHOLDS.bronze && !medals.bronze?.unlocked) medals.bronze = { unlocked: true, at: now };
  if (wins >= MEDAL_THRESHOLDS.silver && !medals.silver?.unlocked) medals.silver = { unlocked: true, at: now };
  if (wins >= MEDAL_THRESHOLDS.gold && !medals.gold?.unlocked) medals.gold = { unlocked: true, at: now };
  const withImages = ALL_ITEMS.filter(it => it && it.image).map(it => it.id);
  const uniqueNeeded = new Set(withImages); let allSeen = true; uniqueNeeded.forEach(id => { if (!seen.has(id)) allSeen = false; });
  if (allSeen && !medals.explorer?.unlocked) medals.explorer = { unlocked: true, at: now };
  saveMedals(medals); updateMedalsUI();
  if (medals.gold?.at === now) showToast('¡Medalla de oro!', 'assets/medals/gold.svg');
  else if (medals.silver?.at === now) showToast('¡Medalla de plata!', 'assets/medals/silver.svg');
  else if (medals.bronze?.at === now) showToast('¡Medalla de bronce!', 'assets/medals/bronze.svg');
  if (medals.explorer?.at === now) showToast('¡Medalla de explorador!', 'assets/medals/explorer.svg');
}

let toastTimer = null;
function showToast(text, icon) {
  const el = document.getElementById('toast');
  const tIcon = document.getElementById('toastIcon');
  const tText = document.getElementById('toastText');
  if (!el || !tIcon || !tText) return;
  tText.textContent = text;
  if (icon) { tIcon.src = icon; tIcon.style.display = 'block'; } else { tIcon.style.display = 'none'; }
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show'); }, 2200);
}

function openAchievements() { renderAchievementsPanel(); achievementsOverlay.hidden = false; }
function closeAchievements() { achievementsOverlay.hidden = true; }
if (achievementsBtn) achievementsBtn.addEventListener('click', openAchievements);
if (achievementsClose) achievementsClose.addEventListener('click', closeAchievements);
if (achievementsOverlay) achievementsOverlay.addEventListener('click', (e) => { if (e.target === achievementsOverlay) closeAchievements(); });

function resetProgress() {
  localStorage.removeItem('sm_wins');
  localStorage.removeItem('sm_seen');
  localStorage.removeItem('sm_medals');
  updateWinsUI(); updateMedalsUI(); if (!achievementsOverlay.hidden) renderAchievementsPanel();
}
if (resetProgressBtn) resetProgressBtn.addEventListener('click', resetProgress);

resetBtn.addEventListener('click', init);
init();

