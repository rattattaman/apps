export type ArenaWall = 'left' | 'right' | 'top' | 'bottom';

export interface Velocity {
  x: number;
  y: number;
}

export function closestArenaWall(
  x: number,
  y: number,
  inset: number,
  arenaWidth: number,
  arenaHeight: number,
): ArenaWall {
  const distances: Array<[ArenaWall, number]> = [
    ['left', Math.abs(x - inset)],
    ['right', Math.abs(arenaWidth - inset - x)],
    ['top', Math.abs(y - inset)],
    ['bottom', Math.abs(arenaHeight - inset - y)],
  ];
  distances.sort((first, second) => first[1] - second[1]);
  return (distances[0] as [ArenaWall, number])[0];
}

export function escapeWallVelocity(
  wall: ArenaWall,
  velocity: Velocity,
  minimumInwardSpeed: number,
): Velocity {
  switch (wall) {
    case 'left': return { x: Math.max(Math.abs(velocity.x), minimumInwardSpeed), y: velocity.y };
    case 'right': return { x: -Math.max(Math.abs(velocity.x), minimumInwardSpeed), y: velocity.y };
    case 'top': return { x: velocity.x, y: Math.max(Math.abs(velocity.y), minimumInwardSpeed) };
    case 'bottom': return { x: velocity.x, y: -Math.max(Math.abs(velocity.y), minimumInwardSpeed) };
  }
}
