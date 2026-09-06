export interface TargetPosition { x: number; y: number; alive: boolean }

/** Stable tie breaking matches the previous distance sort, without sorting or allocating. */
export function nearestTarget<T extends TargetPosition>(source: T, candidates: readonly T[], accepts?: (candidate: T) => boolean): T | undefined {
  let nearest: T | undefined;
  let distance = Infinity;
  for (const candidate of candidates) {
    if (!candidate.alive || candidate === source || (accepts && !accepts(candidate))) continue;
    const dx = source.x - candidate.x;
    const dy = source.y - candidate.y;
    const squared = dx * dx + dy * dy;
    if (squared < distance) { nearest = candidate; distance = squared; }
  }
  return nearest;
}
