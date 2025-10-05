// Simple image/label matching game engine

const board = document.getElementById('board');
const resetBtn = document.getElementById('resetBtn');
const statusEl = document.getElementById('status');

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
      announce(`${state.matched}/${state.totalPairs} parejas`);
      resetPick(state);
      if (state.matched === state.totalPairs) announce('Completado!');
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
  // Only 18 cards (9 pairs). Pick a random subset of items that have images.
  const PAIRS = 9;
  const withImages = items.filter(it => it && it.image);
  const chosen = shuffle(withImages).slice(0, Math.min(PAIRS, withImages.length));
  const deck = buildDeck(chosen);
  renderBoard(deck);
}

resetBtn.addEventListener('click', init);
init();
