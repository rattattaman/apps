export interface Occupant { x: number; y: number; radius: number }
export interface SpawnPosition { x: number; y: number; angle: number }

export function fits(position: { x: number; y: number }, radius: number, inset: number, size: number, occupants: readonly Occupant[]): boolean {
  const edge = inset + radius + 3;
  if (position.x < edge || position.y < edge || position.x > size - edge || position.y > size - edge) return false;
  return occupants.every((other) => (position.x - other.x) ** 2 + (position.y - other.y) ** 2 >= (radius + other.radius + 6) ** 2);
}

/** Keep the preferred position when possible; otherwise search deterministic nearby rings. */
export function findFreePosition(preferred: SpawnPosition, radius: number, inset: number, size: number, occupants: readonly Occupant[]): SpawnPosition | undefined {
  const edge = inset + radius + 3;
  if (edge > size / 2) return undefined;
  const clamp = (n: number) => Math.max(edge, Math.min(size - edge, n));
  const first = { ...preferred, x: clamp(preferred.x), y: clamp(preferred.y) };
  if (fits(first, radius, inset, size, occupants)) return first;
  const cellSize = 64;
  const cells = new Map<number, Occupant[]>();
  const stride = Math.ceil(size / cellSize) + 1;
  for (const other of occupants) {
    for (let cy = Math.max(0, Math.floor((other.y - other.radius) / cellSize)); cy <= Math.min(stride - 1, Math.floor((other.y + other.radius) / cellSize)); cy += 1) {
      for (let cx = Math.max(0, Math.floor((other.x - other.radius) / cellSize)); cx <= Math.min(stride - 1, Math.floor((other.x + other.radius) / cellSize)); cx += 1) {
        const key = cy * stride + cx;
        const bucket = cells.get(key);
        if (bucket) bucket.push(other); else cells.set(key, [other]);
      }
    }
  }
  const free = (x: number, y: number): boolean => {
    if (x < edge || y < edge || x > size - edge || y > size - edge) return false;
    for (let cy = Math.max(0, Math.floor((y - radius - 6) / cellSize)); cy <= Math.min(stride - 1, Math.floor((y + radius + 6) / cellSize)); cy += 1) {
      for (let cx = Math.max(0, Math.floor((x - radius - 6) / cellSize)); cx <= Math.min(stride - 1, Math.floor((x + radius + 6) / cellSize)); cx += 1) {
        for (const other of cells.get(cy * stride + cx) ?? []) {
          if ((x - other.x) ** 2 + (y - other.y) ** 2 < (radius + other.radius + 6) ** 2) return false;
        }
      }
    }
    return true;
  };
  // Candidate count scales with area; do not create a body at the "least bad" overlap.
  const spacing = Math.max(12, radius);
  for (let distance = spacing; distance <= size * Math.SQRT2; distance += spacing) {
    const count = Math.ceil(Math.PI * 2 * distance / spacing);
    for (let index = 0; index < count; index += 1) {
      const angle = preferred.angle + index * Math.PI * 2 / count;
      const candidate = { x: first.x + Math.cos(angle) * distance, y: first.y + Math.sin(angle) * distance, angle: preferred.angle };
      if (free(candidate.x, candidate.y)) return candidate;
    }
  }
  return undefined;
}
