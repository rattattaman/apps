import Phaser from 'phaser';
import './style.css';
import { arenaSizeForFighterCount, DEFAULT_FIGHTERS, WEAPONS } from './config/balance';
import { gameEvents, type FighterHudState } from './events';
import { BattleScene } from './scenes/BattleScene';
import { loadStats, recordBattle } from './storage/stats';
import type { BattleConfig, WeaponType } from './types';
import { generateSeed } from './utils/seededRandom';

interface BattleEndPayload {
  winner: FighterHudState;
  weapon: WeaponType;
  seed: string;
}

interface BattleEventPayload {
  kind: string;
  title: string;
  detail: string;
}

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Falta el elemento #${id}`);
  return element as T;
};

const setupOverlay = byId<HTMLDivElement>('setup-overlay');
const setupForm = byId<HTMLFormElement>('setup-form');
const rosterEditor = byId<HTMLDivElement>('roster-editor');
const fighterCount = byId<HTMLSelectElement>('fighter-count');
const healthInput = byId<HTMLInputElement>('starting-health');
const healthOutput = byId<HTMLOutputElement>('health-output');
const seedInput = byId<HTMLInputElement>('seed-input');
const seedDisplay = byId<HTMLElement>('seed-display');
const scoreboard = byId<HTMLElement>('scoreboard');
const eventFeed = byId<HTMLDivElement>('event-feed');
const winnerPanel = byId<HTMLDivElement>('winner-panel');
const pauseButton = byId<HTMLButtonElement>('pause-button');
const muteButton = byId<HTMLButtonElement>('mute-button');
const particlesButton = byId<HTMLButtonElement>('particles-button');
const battleStatus = byId<HTMLElement>('battle-status');
const transitionOverlay = byId<HTMLDivElement>('transition-overlay');
const arenaFrame = document.querySelector<HTMLElement>('.arena-frame');
if (!arenaFrame) throw new Error('Falta el marco de la arena');
const resolvedArenaFrame: HTMLElement = arenaFrame;
const foundStartButton = setupForm.querySelector<HTMLButtonElement>('button[type="submit"]');
if (!foundStartButton) throw new Error('Falta el botón de inicio');
const startButton: HTMLButtonElement = foundStartButton;
const defaultArenaSize = arenaSizeForFighterCount(DEFAULT_FIGHTERS.length);
resolvedArenaFrame.style.setProperty('--arena-size', `${defaultArenaSize}px`);

let currentConfig: BattleConfig = {
  seed: 'ORB-ARENA', startingHealth: 100, chaosMode: false, fighters: DEFAULT_FIGHTERS,
};
let muted = false;
let particlesEnabled = true;
let paused = false;
let simulationSpeed = 1;
let startPending = false;

seedInput.value = generateSeed();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-canvas',
  width: defaultArenaSize,
  height: defaultArenaSize,
  backgroundColor: '#0b0e17',
  transparent: true,
  antialias: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: {
    default: 'matter',
    matter: { gravity: { x: 0, y: 0 }, debug: false, enableSleeping: false },
  },
  scene: [BattleScene],
});

function battleScene(): BattleScene {
  return game.scene.getScene('battle') as unknown as BattleScene;
}

function renderRoster(): void {
  const count = Number(fighterCount.value);
  rosterEditor.innerHTML = DEFAULT_FIGHTERS.slice(0, count).map((fighter, index) => `
    <label class="fighter-picker" style="--fighter-color:${fighter.colorCss}">
      <span class="fighter-number">${String(index + 1).padStart(2, '0')}</span>
      <span class="fighter-swatch"></span>
      <span class="fighter-copy"><b>${fighter.name}</b><small>Temporada ${fighter.season}</small></span>
      <select name="weapon-${index}" aria-label="Arma de ${fighter.name}">
        ${Object.values(WEAPONS).map((weapon) => `<option value="${weapon.type}" ${fighter.weapon === weapon.type ? 'selected' : ''}>${weapon.name}</option>`).join('')}
      </select>
    </label>
  `).join('');
}

function readConfig(): BattleConfig {
  const count = Number(fighterCount.value);
  return {
    seed: seedInput.value.trim() || generateSeed(),
    startingHealth: Number(healthInput.value),
    chaosMode: byId<HTMLInputElement>('chaos-mode').checked,
    fighters: DEFAULT_FIGHTERS.slice(0, count).map((fighter, index) => ({
      ...fighter,
      weapon: (setupForm.elements.namedItem(`weapon-${index}`) as HTMLSelectElement).value as WeaponType,
    })),
  };
}

function renderScoreboard(states: FighterHudState[]): void {
  scoreboard.style.setProperty('--fighter-count', String(states.length));
  scoreboard.innerHTML = states.map((fighter) => {
    const healthPercent = Math.max(0, fighter.health / fighter.maxHealth * 100);
    return `<article class="fighter-card ${fighter.alive ? '' : 'eliminated'}" style="--fighter-color:${fighter.colorCss}">
      <span class="fighter-swatch"></span>
      <span class="fighter-card-copy"><b>${fighter.name}</b><small>${fighter.weaponName} · ${fighter.stat}</small></span>
      <span class="health"><b>${Math.ceil(fighter.health)}</b><span><i style="width:${healthPercent}%"></i></span></span>
    </article>`;
  }).join('');
}

function initialHud(config: BattleConfig): FighterHudState[] {
  return config.fighters.map((fighter, index) => ({
    id: `fighter-${index}`,
    name: fighter.name,
    weaponName: WEAPONS[fighter.weapon].name,
    ability: WEAPONS[fighter.weapon].ability,
    colorCss: fighter.colorCss,
    health: config.startingHealth,
    maxHealth: config.startingHealth,
    alive: true,
    stat: fighter.weapon === 'bow'
      ? `RÁFAGA ×${WEAPONS[fighter.weapon].initialBurstSize ?? 1}`
      : fighter.weapon === 'wand'
        ? `DAÑO ${WEAPONS.wand.damage} · EXPLOSIÓN ${WEAPONS.wand.initialExplosionSize ?? 1}`
        : fighter.weapon === 'shield'
          ? `ESCUDO ${WEAPONS.shield.initialShieldSize ?? 1}`
          : fighter.weapon === 'scythe'
            ? 'VENENO +1'
            : fighter.weapon === 'unarmed'
              ? `VEL. MÁX ${WEAPONS.unarmed.initialMaxSpeed ?? 4.2}`
              : fighter.weapon === 'wrench'
                ? 'TORRETA ACTIVA'
                : fighter.weapon === 'katana'
                  ? `CORTES ×${WEAPONS.katana.initialCutCount ?? 1}`
                  : fighter.weapon === 'bottle'
                    ? 'BABA DPS CRECIENTE'
                    : fighter.weapon === 'hammer'
                      ? `GIRO ${WEAPONS.hammer.angularSpeed}/${WEAPONS.hammer.initialMaxAngularSpeed ?? 3}`
                      : fighter.weapon === 'crusher'
                        ? `DAÑO ${WEAPONS.crusher.damage}`
                        : fighter.weapon === 'orbit'
                          ? `ÓRBITAS ×${WEAPONS.orbit.initialSatelliteCount ?? 0}`
                          : fighter.weapon === 'giant'
                            ? `TAMAÑO +${WEAPONS.giant.initialSizeLevel ?? 0}`
                            : fighter.weapon === 'laser'
                              ? `RECARGA ${WEAPONS.laser.initialLaserCooldownMs ?? 900} MS`
                              : fighter.weapon === 'lyna'
                                ? `ORBITAS ×${WEAPONS.lyna.initialLynaOrbCount ?? 0}`
                                : fighter.weapon === 'duplicator'
                                  ? 'COPIAS AUTOMÁTICAS'
                  : `DAÑO ${WEAPONS[fighter.weapon].damage}`,
  }));
}

function startBattle(config: BattleConfig): void {
  if (startPending) return;
  startPending = true;
  startButton.disabled = true;
  transitionOverlay.classList.remove('hidden');
  currentConfig = structuredClone(config);
  seedInput.value = currentConfig.seed;
  seedDisplay.textContent = currentConfig.seed;
  battleStatus.textContent = currentConfig.chaosMode ? 'CAOS EN CURSO' : 'BATALLA EN CURSO';
  renderScoreboard(initialHud(currentConfig));
  winnerPanel.classList.add('hidden');
  eventFeed.innerHTML = '';
  setupOverlay.classList.add('hidden');
  paused = false;
  updatePauseButton();
  const arenaSize = arenaSizeForFighterCount(currentConfig.fighters.length);
  resolvedArenaFrame.style.setProperty('--arena-size', `${arenaSize}px`);
  game.scale.resize(arenaSize, arenaSize);
  game.registry.set('battleConfig', currentConfig);
  game.registry.set('simulationSpeed', simulationSpeed);
  game.registry.set('muted', muted);
  game.registry.set('particlesEnabled', particlesEnabled);
  battleScene().scene.restart();
}

function openSetup(newSeed: boolean): void {
  transitionOverlay.classList.add('hidden');
  startPending = false;
  startButton.disabled = false;
  if (newSeed) seedInput.value = generateSeed();
  if (!game.scene.isPaused('battle')) game.scene.pause('battle');
  setupOverlay.classList.remove('hidden');
}

function addEvent(payload: BattleEventPayload): void {
  const entry = document.createElement('div');
  entry.className = `event-entry ${payload.kind}`;
  entry.innerHTML = `<b>${payload.title}</b><span>${payload.detail}</span>`;
  eventFeed.prepend(entry);
  while (eventFeed.children.length > 4) eventFeed.lastElementChild?.remove();
  window.setTimeout(() => entry.classList.add('faded'), 2_400);
  window.setTimeout(() => entry.remove(), 3_100);
}

function updatePauseButton(): void {
  pauseButton.textContent = paused ? '▶' : 'Ⅱ';
  pauseButton.setAttribute('aria-label', paused ? 'Reanudar batalla' : 'Pausar batalla');
  pauseButton.title = paused ? 'Reanudar' : 'Pausar';
  if (!winnerPanel.classList.contains('hidden')) return;
  battleStatus.textContent = paused ? 'BATALLA EN PAUSA' : (currentConfig.chaosMode ? 'CAOS EN CURSO' : 'BATALLA EN CURSO');
}

function updateCareerStats(): void {
  const stats = loadStats();
  const element = document.getElementById('career-stats');
  if (element) element.textContent = `${stats.battles} batallas guardadas`;
}

fighterCount.addEventListener('change', renderRoster);
healthInput.addEventListener('input', () => { healthOutput.value = healthInput.value; });
byId<HTMLButtonElement>('random-seed').addEventListener('click', () => { seedInput.value = generateSeed(); });
setupForm.addEventListener('submit', (event) => {
  event.preventDefault();
  startBattle(readConfig());
});

pauseButton.addEventListener('click', () => {
  paused = battleScene().togglePause();
  updatePauseButton();
});
byId<HTMLButtonElement>('restart-button').addEventListener('click', () => startBattle(currentConfig));
byId<HTMLButtonElement>('setup-button').addEventListener('click', () => openSetup(false));
byId<HTMLButtonElement>('replay-button').addEventListener('click', () => startBattle(currentConfig));
byId<HTMLButtonElement>('new-battle-button').addEventListener('click', () => openSetup(true));

document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((button) => {
  button.addEventListener('click', () => {
    const speed = Number(button.dataset.speed);
    simulationSpeed = speed;
    game.registry.set('simulationSpeed', speed);
    battleScene().setSimulationSpeed(speed);
    document.querySelectorAll('[data-speed]').forEach((candidate) => candidate.classList.toggle('active', candidate === button));
  });
});

muteButton.addEventListener('click', () => {
  muted = !muted;
  muteButton.textContent = muted ? '×' : '♪';
  muteButton.setAttribute('aria-pressed', String(muted));
  game.registry.set('muted', muted);
  battleScene().setMuted(muted);
});

particlesButton.addEventListener('click', () => {
  particlesEnabled = !particlesEnabled;
  particlesButton.classList.toggle('disabled', !particlesEnabled);
  particlesButton.setAttribute('aria-pressed', String(particlesEnabled));
  particlesButton.textContent = particlesEnabled ? '✦ Partículas' : 'Partículas off';
  game.registry.set('particlesEnabled', particlesEnabled);
  battleScene().setParticles(particlesEnabled);
});

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
  if (event.key.toLowerCase() === 'p') pauseButton.click();
  if (event.key.toLowerCase() === 'r') byId<HTMLButtonElement>('restart-button').click();
  if (event.key.toLowerCase() === 'm') muteButton.click();
});

gameEvents.on('battle:hud', (states: FighterHudState[]) => renderScoreboard(states));
gameEvents.on('battle:event', (payload: BattleEventPayload) => addEvent(payload));
gameEvents.on('battle:started', () => {
  startPending = false;
  startButton.disabled = false;
  transitionOverlay.classList.add('hidden');
});
gameEvents.on('battle:ended', (payload: BattleEndPayload) => {
  recordBattle(payload.weapon);
  updateCareerStats();
  battleStatus.textContent = 'BATALLA FINALIZADA';
  byId('winner-name').textContent = `${payload.winner.name} GANA`;
  byId('winner-name').style.color = payload.winner.colorCss;
  byId('winner-detail').textContent = `${payload.winner.weaponName} · ${payload.winner.stat} · Semilla ${payload.seed}`;
  winnerPanel.classList.remove('hidden');
});

renderRoster();
renderScoreboard(initialHud(currentConfig));
updateCareerStats();
