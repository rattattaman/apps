import { DEFAULT_FIGHTERS, WEAPONS } from '../config/balance';
import { Tournament, CUP_RULES, type CupMatch } from '../modes/Tournament';
import { ArcadeMusic } from '../audio/ArcadeMusic';
import { loadPreferences, savePreferences } from '../storage/preferences';
import type { BattleConfig, BattleResult } from '../types';

const escape = (s: string): string => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export class Phase2Controller {
  private cup: Tournament | null = null;
  private match: CupMatch | null = null;
  private base: BattleConfig | null = null;
  private prefs = loadPreferences();
  private music = new ArcadeMusic();
  private active = false;
  private mode: HTMLSelectElement;
  private tournamentPanel: HTMLElement;
  private summary: HTMLElement;
  constructor(private start: (config: BattleConfig) => void, private volume: (value: number) => void, private skip: () => void) {
    document.querySelector('.setup-grid')!.insertAdjacentHTML('afterbegin', '<label class="field"><span>Modo</span><select id="battle-mode"><option value="ffa">Todos contra todos</option><option value="teams">2 contra 2</option><option value="cup">Copa de duelos</option></select></label>');
    this.mode = document.querySelector('#battle-mode')!;
    this.tournamentPanel = document.createElement('section'); this.tournamentPanel.className = 'cup-panel hidden';
    this.tournamentPanel.innerHTML = `<h2>Copa de duelos</h2><p>${CUP_RULES}</p><button type="button" id="cup-all">Seleccionar todos</button><button type="button" id="cup-none">Vaciar selección</button><div class="cup-selection">${DEFAULT_FIGHTERS.map((f,i)=>`<label><input type="checkbox" name="cup-entry" value="${i}" checked> ${escape(f.name)} · ${WEAPONS[f.weapon].name}</label>`).join('')}</div><div id="cup-progress"></div>`;
    document.querySelector('.roster-fieldset')!.after(this.tournamentPanel);
    this.summary = document.createElement('div'); this.summary.id = 'battle-report';
    document.querySelector('#winner-detail')!.after(this.summary);
    document.querySelector('.winner-actions')!.insertAdjacentHTML('beforeend', '<button type="button" id="cup-next" class="button button-primary hidden">Siguiente duelo</button><button type="button" id="cup-cancel" class="button hidden">Cancelar copa</button>');
    document.querySelector('.control-dock')!.insertAdjacentHTML('beforeend', '<div class="audio-controls"><label>Música <input id="music-volume" aria-label="Volumen de música" type="range" min="0" max="100"></label><label>Efectos <input id="effects-volume" aria-label="Volumen de efectos" type="range" min="0" max="100"></label><button type="button" id="skip-final">Omitir golpe final</button></div>');
    const musicInput = document.querySelector<HTMLInputElement>('#music-volume')!, effectsInput = document.querySelector<HTMLInputElement>('#effects-volume')!;
    musicInput.value = String(this.prefs.music*100); effectsInput.value = String(this.prefs.effects*100);
    musicInput.oninput = () => { this.prefs.music = Number(musicInput.value)/100; this.music.setVolume(this.prefs.music); this.save(); if (this.active && !this.prefs.muted) this.music.start(); };
    effectsInput.oninput = () => { this.prefs.effects = Number(effectsInput.value)/100; this.volume(this.prefs.effects); this.save(); };
    document.querySelector<HTMLButtonElement>('#skip-final')!.onclick = this.skip;
    document.querySelector<HTMLButtonElement>('#cup-all')!.onclick = () => this.selectAll(true);
    document.querySelector<HTMLButtonElement>('#cup-none')!.onclick = () => this.selectAll(false);
    document.querySelector<HTMLButtonElement>('#cup-next')!.onclick = () => this.playNext();
    document.querySelector<HTMLButtonElement>('#cup-cancel')!.onclick = () => { this.cancel(); document.querySelector<HTMLButtonElement>('#setup-button')!.click(); };
    this.mode.onchange = () => {
      this.cancel();
      const teams = this.mode.value === 'teams', cup = this.mode.value === 'cup';
      const count = document.querySelector<HTMLSelectElement>('#fighter-count')!;
      count.disabled = teams || cup;
      if (teams) { count.value = '4'; count.dispatchEvent(new Event('change')); }
      document.querySelector('.roster-fieldset')!.classList.toggle('hidden', cup);
      this.tournamentPanel.classList.toggle('hidden', !cup);
      document.querySelector('#team-rules')?.remove();
      if (teams) document.querySelector('.roster-fieldset')!.insertAdjacentHTML('afterbegin','<p id="team-rules">Equipo A: puestos 1 y 2. Equipo B: 3 y 4. Sin fuego amigo. Las invocaciones no mantienen un equipo cuyos principales han caído.</p>');
    };
    window.addEventListener('blur', () => this.music.pause());
    window.addEventListener('focus', () => { if (this.active && !this.prefs.muted) this.music.start(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.music.pause();
      else if (this.active && !this.prefs.muted) this.music.start();
    });
    window.addEventListener('pagehide', () => this.music.destroy());
  }
  get preferences() { return {...this.prefs}; }
  private save(): void { savePreferences(this.prefs); }
  private selectAll(value: boolean): void { document.querySelectorAll<HTMLInputElement>('[name="cup-entry"]').forEach(input => { input.checked = value; }); }
  sound(muted: boolean): void { this.prefs.muted = muted; this.save(); if (muted) this.music.pause(); else if (this.active) this.music.start(); }
  effects(enabled: boolean): void { this.prefs.reduced = !enabled; this.save(); }
  playing(active: boolean): void { this.active = active; this.music.setVolume(this.prefs.music); if (active && !this.prefs.muted) this.music.start(); else this.music.pause(); }
  submit(config: BattleConfig): void {
    if (this.mode.value === 'cup') {
      const selected = [...document.querySelectorAll<HTMLInputElement>('[name="cup-entry"]:checked')].map(input => DEFAULT_FIGHTERS[Number(input.value)]!);
      if (selected.length < 2) { document.querySelector('#cup-progress')!.textContent = 'Selecciona al menos dos participantes.'; return; }
      this.base = config; this.cup = new Tournament(selected, config.seed); this.playNext();
    } else {
      this.cancel(); config.mode = this.mode.value === 'teams' ? 'teams' : 'ffa';
      config.fighters = config.fighters.map((f,i) => ({...f, team: config.mode === 'teams' ? (i<2 ? 'A' : 'B') : undefined}));
      this.start(config);
    }
  }
  private playNext(): void {
    if (!this.cup || !this.base) return;
    this.match = this.cup.next() ?? null;
    if (!this.match) { this.renderCup(); return; }
    this.start({...this.base, mode: 'ffa', seed: this.base.seed+'-CUP-'+this.match.id,
      fighters: [this.cup.entry(this.match.a).fighter, this.cup.entry(this.match.b).fighter].map(f=>({...f,team:undefined}))});
  }
  cancel(): void { this.cup = null; this.match = null; const progress = document.querySelector('#cup-progress'); if (progress) progress.textContent = ''; document.querySelector('#cup-next')!.classList.add('hidden'); document.querySelector('#cup-cancel')!.classList.add('hidden'); }
  result(result: BattleResult): void {
    this.playing(false);
    this.summary.innerHTML = `<p>${Math.round(result.durationMs/1000)} s de simulación${result.team ? ' · Equipo '+result.team : ''}</p><div class="report-scroll"><table><thead><tr><th>Combatiente</th><th>Daño real</th><th>Vida</th><th>Bajas</th><th>Invocaciones</th></tr></thead><tbody>${result.reports.map(r=>`<tr><th>${escape(r.name)}${r.team?' · '+r.team:''}</th><td>${r.damage.toFixed(1)}</td><td>${r.health.toFixed(1)}</td><td>${r.eliminations}</td><td>${r.summonsDestroyed}</td></tr>`).join('')}</tbody></table></div><p class="report-note">Daño de invocaciones atribuido al creador. Bajas cuenta principales; invocaciones cuenta clones/copias destruidos. Las torretas actuales no tienen vida ni se destruyen por daño.</p>`;
    if (result.reports.some(r=>r.team)) {
      this.summary.insertAdjacentHTML('beforeend', ['A','B'].map(team=>{const rows=result.reports.filter(r=>r.team===team); return `<p>Equipo ${team}: daño ${rows.reduce((n,r)=>n+r.damage,0).toFixed(1)} · vida ${rows.reduce((n,r)=>n+r.health,0).toFixed(1)} · bajas ${rows.reduce((n,r)=>n+r.eliminations,0)}</p>`;}).join(''));
    }
    if (this.cup && this.match) {
      const winner = result.winnerPrincipalId === 'fighter-0' ? 'a' : result.winnerPrincipalId === 'fighter-1' ? 'b' : null;
      this.cup.record(this.match.id, winner, result.reports[0]?.principalDamage ?? 0, result.reports[1]?.principalDamage ?? 0);
      this.cup.next(); this.renderCup();
    }
  }
  private renderCup(): void {
    if (!this.cup) return;
    const cup = this.cup;
    const groups = [...new Set(cup.entrants.map(e=>e.group))];
    const html = `<h3>${cup.champion ? 'Campeón: '+escape(cup.entry(cup.champion).fighter.name) : 'Copa · clasificación'}</h3>${groups.map(g=>`<h4>Grupo ${g+1}</h4><p>${cup.standings(g).map(e=>`${escape(e.fighter.name)} ${e.points} pt (${e.played} PJ)`).join(' · ')}</p>`).join('')}<ol>${cup.matches.map(m=>`<li>${m.stage}: ${escape(cup.entry(m.a).fighter.name)} / ${escape(cup.entry(m.b).fighter.name)} — ${m.completed ? m.winner ? escape(cup.entry(m.winner).fighter.name) : 'Empate' : 'Pendiente'}</li>`).join('')}</ol>${cup.decisions.map(d=>`<p>${escape(d)}</p>`).join('')}`;
    this.summary.insertAdjacentHTML('beforeend', '<section class="cup-results">'+html+'</section>');
    document.querySelector('#cup-progress')!.innerHTML = html;
    document.querySelector('#cup-next')!.classList.toggle('hidden', !!cup.champion);
    document.querySelector('#cup-cancel')!.classList.remove('hidden');
  }
}
