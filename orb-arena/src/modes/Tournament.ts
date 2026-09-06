import type { FighterSelection } from '../types';
import { SeededRandom } from '../utils/seededRandom';

export interface Entrant { id: string; fighter: FighterSelection; group: number; points: number; wins: number; played: number; damage: number; drawOrder: number }
export interface CupMatch { id: number; a: string; b: string; stage: string; group?: number; winner?: string | null; completed: boolean; replay?: boolean }
export const CUP_RULES = 'Grupos de hasta 4: victoria 3 puntos, empate 1. Clasifican los dos primeros (o el único participante). Desempate: victorias, daño real a principales y sorteo inicial con semilla. Eliminatorias: una revancha si hay empate; segundo empate por sorteo con semilla anunciado. Pases sin combate cuando faltan rivales. Cada duelo reinicia vida y mejoras.';

export class Tournament {
  readonly entrants: Entrant[];
  readonly matches: CupMatch[] = [];
  champion: string | null = null;
  private random: SeededRandom;
  private phase: 'groups' | 'knockout' = 'groups';
  private round = 0;
  private advancing: string[] = [];
  readonly decisions: string[] = [];
  constructor(fighters: FighterSelection[], seed: string) {
    if (fighters.length < 2) throw new Error('Selecciona al menos dos participantes');
    this.random = new SeededRandom(seed + '-cup');
    const shuffled = fighters.map((fighter, i) => ({ fighter, id: 'p' + i }));
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(this.random.next() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    const groups = Math.ceil(fighters.length / 4);
    this.entrants = shuffled.map((entry, i) => ({ ...entry, fighter: { ...entry.fighter, team: undefined }, group: i % groups, points: 0, wins: 0, played: 0, damage: 0, drawOrder: i }));
    for (let group = 0; group < groups; group++) {
      const members = this.entrants.filter(e => e.group === group);
      for (let a = 0; a < members.length; a++) for (let b = a + 1; b < members.length; b++) this.add(members[a]!.id, members[b]!.id, 'Grupo ' + (group + 1), group);
    }
  }
  private add(a: string, b: string, stage: string, group?: number, replay = false): void {
    this.matches.push({id: this.matches.length, a, b, stage, group, completed: false, replay});
  }
  entry(id: string): Entrant { return this.entrants.find(e => e.id === id)!; }
  standings(group: number): Entrant[] {
    return this.entrants.filter(e => e.group === group).sort((a, b) => b.points - a.points || b.wins - a.wins || b.damage - a.damage || a.drawOrder - b.drawOrder);
  }
  next(): CupMatch | undefined {
    const pending = this.matches.find(m => !m.completed);
    if (pending || this.champion) return pending;
    if (this.phase === 'groups') {
      this.phase = 'knockout';
      this.advancing = [...new Set(this.entrants.map(e => e.group))].flatMap(g => this.standings(g).slice(0,2).map(e => e.id));
    }
    if (this.advancing.length === 1) { this.champion = this.advancing[0]!; return undefined; }
    const ids = this.advancing;
    this.advancing = [];
    this.round++;
    // Seeded draw avoids giving the same array position all byes.
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(this.random.next() * (i + 1)); [ids[i], ids[j]] = [ids[j]!, ids[i]!]; }
    for (let i = 0; i < ids.length; i += 2) {
      if (!ids[i+1]) { this.advancing.push(ids[i]!); this.decisions.push(this.entry(ids[i]!).fighter.name + ': pase sin rival'); }
      else this.add(ids[i]!, ids[i+1]!, ids.length === 2 ? 'Final' : 'Eliminatoria ' + this.round);
    }
    return this.matches.find(m => !m.completed);
  }
  record(id: number, winner: 'a' | 'b' | null, damageA: number, damageB: number): void {
    const match = this.matches.find(m => m.id === id);
    if (!match || match.completed) return;
    match.completed = true;
    match.winner = winner === 'a' ? match.a : winner === 'b' ? match.b : null;
    if (match.group !== undefined) {
      const a = this.entry(match.a), b = this.entry(match.b);
      a.played++; b.played++; a.damage += damageA; b.damage += damageB;
      if (!winner) { a.points++; b.points++; }
      else { const e = winner === 'a' ? a : b; e.points += 3; e.wins++; }
    } else if (!winner && !match.replay) {
      this.add(match.a, match.b, match.stage + ' · revancha', undefined, true);
    } else {
      if (!match.winner) {
        match.winner = this.random.next() < 0.5 ? match.a : match.b;
        this.decisions.push('Segundo empate: sorteo con semilla clasifica a ' + this.entry(match.winner).fighter.name);
      }
      this.advancing.push(match.winner);
    }
  }
}
