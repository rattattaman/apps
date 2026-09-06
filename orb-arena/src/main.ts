import Phaser from 'phaser';
import './style.css';
import { arenaSizeForFighterCount, DEFAULT_FIGHTERS, WEAPONS } from './config/balance';
import { gameEvents, type FighterHudState } from './events';
import { BattleScene } from './scenes/BattleScene';
import { loadStats, recordBattle } from './storage/stats';
import type { BattleConfig, WeaponType } from './types';
import { generateSeed } from './utils/seededRandom';
import { Scoreboard } from './ui/Scoreboard';
import { Phase2Controller } from './ui/Phase2Controller';
import type { BattleResult } from './types';


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
const scoreboardView = new Scoreboard(scoreboard);
const feedTimers = new Set<number>();
const entryTimers = new Map<Element, Set<number>>();
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
  fps: { smoothStep: false },
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

const phase2 = new Phase2Controller(startBattle, value => {
  game.registry.set('effectsVolume', value);
  if (game.scene.isActive('battle') || game.scene.isPaused('battle')) battleScene().setEffectsVolume(value);
}, () => battleScene().skipFinalMoment());
muted = phase2.preferences.muted;
particlesEnabled = !phase2.preferences.reduced;
game.registry.set('effectsVolume', phase2.preferences.effects);
game.registry.set('muted', muted);
game.registry.set('particlesEnabled', particlesEnabled);
muteButton.setAttribute('aria-pressed', String(muted));
particlesButton.setAttribute('aria-pressed', String(particlesEnabled));
muteButton.textContent = muted ? '♫' : '♪';
particlesButton.classList.toggle('disabled', !particlesEnabled);
particlesButton.textContent = particlesEnabled ? '✦ Partículas' : 'Partículas off';

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
  scoreboardView.render(states);
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
  phase2.playing(true);
  startButton.disabled = true;
  transitionOverlay.classList.remove('hidden');
  currentConfig = structuredClone(config);
  seedInput.value = currentConfig.seed;
  seedDisplay.textContent = currentConfig.seed;
  battleStatus.textContent = currentConfig.chaosMode ? 'CAOS EN CURSO' : 'BATALLA EN CURSO';
  renderScoreboard(initialHud(currentConfig));
  winnerPanel.classList.add('hidden');
  clearEventFeed();
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
  phase2.playing(false);
  clearEventFeed();
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
  while (eventFeed.children.length > 4 && eventFeed.lastElementChild) removeFeedEntry(eventFeed.lastElementChild);
  scheduleFeed(entry, () => entry.classList.add('faded'), 2_400);
  scheduleFeed(entry, () => removeFeedEntry(entry), 3_100);
}

function scheduleFeed(entry: Element, callback: () => void, delay: number): void {
  const timers = entryTimers.get(entry) ?? new Set<number>();
  entryTimers.set(entry, timers);
  const timer = window.setTimeout(() => { feedTimers.delete(timer); timers.delete(timer); callback(); }, delay);
  feedTimers.add(timer);
  timers.add(timer);
}

function removeFeedEntry(entry: Element): void {
  for (const timer of entryTimers.get(entry) ?? []) {
    window.clearTimeout(timer);
    feedTimers.delete(timer);
  }
  entryTimers.delete(entry);
  entry.remove();
}

function clearEventFeed(): void {
  for (const timer of feedTimers) window.clearTimeout(timer);
  feedTimers.clear();
  entryTimers.clear();
  eventFeed.replaceChildren();
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
  phase2.submit(readConfig());
});

pauseButton.addEventListener('click', () => {
  paused = battleScene().togglePause();
  phase2.playing(!paused);
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
  phase2.sound(muted);
});

particlesButton.addEventListener('click', () => {
  particlesEnabled = !particlesEnabled;
  particlesButton.classList.toggle('disabled', !particlesEnabled);
  particlesButton.setAttribute('aria-pressed', String(particlesEnabled));
  particlesButton.textContent = particlesEnabled ? '✦ Partículas' : 'Partículas off';
  game.registry.set('particlesEnabled', particlesEnabled);
  battleScene().setParticles(particlesEnabled);
  phase2.effects(particlesEnabled);
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
  // SceneManager finishes CREATE by setting RUNNING; pause after that transition.
  if (!setupOverlay.classList.contains('hidden')) game.events.once(Phaser.Core.Events.POST_STEP, () => {
    if (!setupOverlay.classList.contains('hidden')) game.scene.pause('battle');
  });
  startPending = false;
  startButton.disabled = false;
  transitionOverlay.classList.add('hidden');
});
gameEvents.on('battle:ended', (payload: BattleResult) => {
  recordBattle(payload.weapon);
  updateCareerStats();
  battleStatus.textContent = 'BATALLA FINALIZADA';
  byId('winner-name').textContent = payload.team ? `EQUIPO ${payload.team} GANA` : payload.winner ? `${payload.winner.name} GANA` : 'EMPATE';
  byId('winner-name').style.color = payload.winner?.colorCss ?? '#ffffff';
  byId('winner-detail').textContent = payload.winner ? `${payload.winner.weaponName} · ${payload.winner.stat} · Semilla ${payload.seed}` : 'Eliminación simultánea';
  phase2.result(payload);
  winnerPanel.classList.remove('hidden');
});

renderRoster();
renderScoreboard(initialHud(currentConfig));
updateCareerStats();
