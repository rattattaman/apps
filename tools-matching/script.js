// Simple image/label matching game engine

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
  { key: 'bronze',   title: 'Bronze medal',  desc: 'Win 10 games', icon: 'assets/medals/bronze.svg', type: 'wins', threshold: 10 },
  { key: 'silver',   title: 'Silver medal',  desc: 'Win 20 games', icon: 'assets/medals/silver.svg', type: 'wins', threshold: 20 },
  { key: 'gold',     title: 'Gold medal',    desc: 'Win 30 games', icon: 'assets/medals/gold.svg',   type: 'wins', threshold: 30 },
  { key: 'explorer', title: 'Explorer medal', desc: 'Match all tools', icon: 'assets/medals/explorer.svg', type: 'explorer' }
];
let ALL_ITEMS = [];

function loadWins() {
  return parseInt(localStorage.getItem('tm_wins') || '0', 10);
}
function saveWins(n) {
  localStorage.setItem('tm_wins', String(n));
}
function loadSeen() {
  try { return new Set(JSON.parse(localStorage.getItem('tm_seen') || '[]')); } catch { return new Set(); }
}
function saveSeen(set) {
  localStorage.setItem('tm_seen', JSON.stringify(Array.from(set)));
}
function loadMedals() {
  try {
    const raw = JSON.parse(localStorage.getItem('tm_medals') || '{}');
    // Normalize boolean -> object
    const norm = {};
    for (const k of Object.keys(raw)) {
      const v = raw[k];
      if (typeof v === 'boolean') norm[k] = v ? { unlocked: true } : { unlocked: false };
      else norm[k] = v;
    }
    return norm;
  } catch {
    return {};
  }
}
function saveMedals(obj) {
  localStorage.setItem('tm_medals', JSON.stringify(obj));
}
function updateWinsUI() {
  const w = loadWins();
  if (winsEl) winsEl.textContent = `Wins: ${w}`;
}
function updateMedalsUI() {
  const medals = loadMedals();
  document.querySelectorAll('.medal').forEach(m => {
    const k = m.getAttribute('data-medal');
    if (medals[k] && medals[k].unlocked) m.classList.add('earned'); else m.classList.remove('earned');
  });
}

function formatDate(d) {
  try { return new Date(d).toLocaleString(); } catch { return String(d); }
}

function renderAchievementsPanel() {
  const wins = loadWins();
  const medals = loadMedals();
  const seen = loadSeen();
  const withImages = ALL_ITEMS.filter(it => it && it.image).map(it => it.id);
  const totalSet = new Set(withImages);
  const total = totalSet.size;
  const seenCount = Array.from(new Set(Array.from(seen).filter(id => totalSet.has(id)))).length;

  const rows = ACHIEVEMENTS.map(a => {
    let status = 'Not earned';
    let date = '';
    if (medals[a.key]?.unlocked) {
      status = 'Unlocked';
      if (medals[a.key]?.at) date = ` · ${formatDate(medals[a.key].at)}`;
    } else if (a.type === 'wins') {
      status = `Progress: ${Math.min(wins, a.threshold)}/${a.threshold}`;
    } else if (a.type === 'explorer') {
      status = `Progress: ${seenCount}/${total}`;
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
      { id: 'tool_generic', label: 'Herramienta', image: '' },
      { id: 'stage_analysis', label: 'Analisis', image: '' }
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

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createCard(cardDef, index, onReveal) {
  const card = document.createElement('button');
  card.className = 'card';
  card.setAttribute('data-id', cardDef.id);
  card.setAttribute('data-type', cardDef.type);
  card.setAttribute('aria-label', 'Carta oculta');

  const back = document.createElement('div');
  back.className = 'face back';
  back.innerHTML = '<svg width="42" height="42" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">\
  <g stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none">\
    <!-- Hammer outline -->\
    <rect x="5" y="6" width="9" height="3" rx="1"/>\
    <line x1="11" y1="9" x2="11" y2="18"/>\
    <!-- Screwdriver crossed -->\
    <line x1="7" y1="17" x2="17" y2="7"/>\
    <polyline points="16,6 18,6 18,8"/>\
  </g>\
  </svg>';

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

  const inner = document.createElement('div');
  inner.className = 'inner';
  inner.appendChild(back);
  inner.appendChild(front);
  card.appendChild(inner);

  card.addEventListener('click', () => {
    if (card.classList.contains('revealed') || card.classList.contains('match')) return;
    onReveal(card, cardDef);
  });

  return card;
}

function renderBoard(deck) {
  board.innerHTML = '';
  const state = {
    first: null,
    second: null,
    busy: false,
    matched: 0,
    totalPairs: deck.length / 2,
  };

  const onReveal = (el, def) => {
    if (state.busy) return;
    el.classList.add('revealed');
    if (!state.first) {
      state.first = { el, def };
      return;
    }
    state.second = { el, def };
    state.busy = true;

    const isMatch = state.first.def.id === state.second.def.id && state.first.def.type !== state.second.def.type;
    if (isMatch) {
      [state.first.el, state.second.el].forEach((c) => c.classList.add('match'));
      state.matched += 1;
      announce(`${state.matched}/${state.totalPairs} pairs`);
      resetPick(state);
      if (state.matched === state.totalPairs) {
        announce('Completed!');
        onWin(deck);
      }
    } else {
      [state.first.el, state.second.el].forEach((c) => c.classList.add('fail'));
      setTimeout(() => {
        [state.first.el, state.second.el].forEach((c) => {
          c.classList.remove('revealed', 'fail');
        });
        resetPick(state);
      }, 750);
    }
  };

  deck.forEach((d, i) => board.appendChild(createCard(d, i, onReveal)));
}

function resetPick(state) {
  state.first = null;
  state.second = null;
  state.busy = false;
}

function announce(msg) {
  statusEl.textContent = msg;
}

async function init() {
  const items = await loadData();
  ALL_ITEMS = items.slice();
  // Only 10 cards (5 pairs). Pick a random subset of items that have images.
  const PAIRS = 5;
  const withImages = items.filter(it => it && it.image);
  const chosen = shuffle(withImages).slice(0, Math.min(PAIRS, withImages.length));
  const deck = buildDeck(chosen);
  renderBoard(deck);
  updateWinsUI();
  updateMedalsUI();
}

function onWin(deck) {
  // Increment wins
  let wins = loadWins();
  wins += 1; saveWins(wins); updateWinsUI();

  // Mark seen ids for explorer medal
  const seen = loadSeen();
  const idsInRound = new Set(deck.map(d => d.id));
  idsInRound.forEach(id => seen.add(id));
  saveSeen(seen);

  // Award medals by thresholds
  const medals = loadMedals();
  const now = new Date().toISOString();
  if (wins >= MEDAL_THRESHOLDS.bronze && !medals.bronze?.unlocked) medals.bronze = { unlocked: true, at: now };
  if (wins >= MEDAL_THRESHOLDS.silver && !medals.silver?.unlocked) medals.silver = { unlocked: true, at: now };
  if (wins >= MEDAL_THRESHOLDS.gold && !medals.gold?.unlocked) medals.gold = { unlocked: true, at: now };

  // Explorer medal: if user has seen all tool ids with image
  const withImages = ALL_ITEMS.filter(it => it && it.image).map(it => it.id);
  const uniqueNeeded = new Set(withImages);
  let allSeen = true;
  uniqueNeeded.forEach(id => { if (!seen.has(id)) allSeen = false; });
  if (allSeen && !medals.explorer?.unlocked) medals.explorer = { unlocked: true, at: now };

  saveMedals(medals);
  updateMedalsUI();
  // Toasts for newly unlocked
  if (medals.gold?.at === now) showToast('¡Medalla de oro!', 'assets/medals/gold.svg');
  else if (medals.silver?.at === now) showToast('¡Medalla de plata!', 'assets/medals/silver.svg');
  else if (medals.bronze?.at === now) showToast('¡Medalla de bronce!', 'assets/medals/bronze.svg');
  if (medals.explorer?.at === now) showToast('¡Medalla de explorador!', 'assets/medals/explorer.svg');
}

// Toast function
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

// Overlay events
function openAchievements() {
  renderAchievementsPanel();
  achievementsOverlay.hidden = false;
}
function closeAchievements() {
  achievementsOverlay.hidden = true;
}
if (achievementsBtn) achievementsBtn.addEventListener('click', openAchievements);
if (achievementsClose) achievementsClose.addEventListener('click', closeAchievements);
if (achievementsOverlay) achievementsOverlay.addEventListener('click', (e) => {
  if (e.target === achievementsOverlay) closeAchievements();
});

// Reset progress
function resetProgress() {
  localStorage.removeItem('tm_wins');
  localStorage.removeItem('tm_seen');
  localStorage.removeItem('tm_medals');
  updateWinsUI();
  updateMedalsUI();
  if (!achievementsOverlay.hidden) renderAchievementsPanel();
}
if (resetProgressBtn) resetProgressBtn.addEventListener('click', resetProgress);

resetBtn.addEventListener('click', init);
init();
