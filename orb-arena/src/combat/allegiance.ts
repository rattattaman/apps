export interface Affiliated { id: string; team?: 'A' | 'B'; alive: boolean; isClone?: boolean; duplicateOwnerId?: string }
export function rivals(a: Affiliated, b: Affiliated): boolean {
  return a.id !== b.id && !(a.team && a.team === b.team);
}
export function survivingTeams(fighters: readonly Affiliated[]): ('A' | 'B')[] {
  return [...new Set(fighters.filter(f => f.alive && !f.isClone && !f.duplicateOwnerId && f.team).map(f => f.team!))];
}
