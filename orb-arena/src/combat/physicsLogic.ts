export interface Velocity {
  x: number;
  y: number;
}

export interface WallContactCorrection {
  x: number;
  y: number;
  velocity: Velocity;
  corrected: boolean;
}

export function resolveArenaWallContact(
  x: number,
  y: number,
  velocity: Velocity,
  inset: number,
  arenaWidth: number,
  arenaHeight: number,
  radius: number,
  minimumInwardSpeed: number,
  separation = 1.5,
): WallContactCorrection {
  const left = inset + radius + separation;
  const right = arenaWidth - inset - radius - separation;
  const top = inset + radius + separation;
  const bottom = arenaHeight - inset - radius - separation;
  let nextX = x;
  let nextY = y;
  let nextVelocityX = velocity.x;
  let nextVelocityY = velocity.y;

  if (x <= left) {
    nextX = left;
    nextVelocityX = Math.max(Math.abs(velocity.x), minimumInwardSpeed);
  } else if (x >= right) {
    nextX = right;
    nextVelocityX = -Math.max(Math.abs(velocity.x), minimumInwardSpeed);
  }

  if (y <= top) {
    nextY = top;
    nextVelocityY = Math.max(Math.abs(velocity.y), minimumInwardSpeed);
  } else if (y >= bottom) {
    nextY = bottom;
    nextVelocityY = -Math.max(Math.abs(velocity.y), minimumInwardSpeed);
  }

  return {
    x: nextX,
    y: nextY,
    velocity: { x: nextVelocityX, y: nextVelocityY },
    corrected: nextX !== x || nextY !== y
      || nextVelocityX !== velocity.x || nextVelocityY !== velocity.y,
  };
}
