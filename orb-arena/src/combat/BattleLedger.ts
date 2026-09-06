import type { CombatReport, FighterSelection } from '../types';

export class BattleLedger {
  private rows = new Map<string, CombatReport>();
  private owners = new Map<string, string>();
  private eliminated = new Set<string>();
  reset(): void { this.rows.clear(); this.owners.clear(); this.eliminated.clear(); }
  principal(id: string, selection: FighterSelection, health: number): void {
    this.owners.set(id, id);
    this.rows.set(id, { id, name: selection.name, weapon: selection.weapon, team: selection.team,
      damage: 0, principalDamage: 0, eliminations: 0, summonsDestroyed: 0, health });
  }
  summon(id: string, creatorId: string): void { this.owners.set(id, this.owners.get(creatorId) ?? creatorId); }
  principalId(id: string): string { return this.owners.get(id) ?? id; }
  hit(source: string, target: string, applied: number): void {
    const row = this.rows.get(this.owners.get(source) ?? source);
    if (!row || applied <= 0 || !Number.isFinite(applied)) return;
    row.damage += applied;
    if (this.rows.has(target)) row.principalDamage += applied;
  }
  eliminate(source: string, target: string): void {
    if (this.eliminated.has(target)) return;
    this.eliminated.add(target);
    const row = this.rows.get(this.owners.get(source) ?? source);
    if (!row) return;
    if (this.rows.has(target)) row.eliminations++; else row.summonsDestroyed++;
  }
  snapshot(health: ReadonlyMap<string, number>): CombatReport[] {
    return [...this.rows.values()].map(row => ({ ...row, health: health.get(row.id) ?? row.health }));
  }
}
