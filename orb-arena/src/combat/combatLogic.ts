import type { WeaponType } from '../types';

export interface WeaponProgress {
  damage: number;
  range: number;
  angularSpeed: number;
  burstSize: number;
  explosionSize: number;
  shieldSize: number;
  maxSpeed: number;
  cutCount: number;
}

export function burstShotDelays(count: number, spacingMs: number): number[] {
  return Array.from({ length: Math.max(0, count) }, (_, index) => index * spacingMs);
}

export function progressAfterHit(type: WeaponType, current: WeaponProgress): WeaponProgress {
  switch (type) {
    case 'sword': return { ...current, damage: current.damage + 1 };
    case 'dagger': return { ...current, angularSpeed: current.angularSpeed + 1.5 };
    case 'spear': return { ...current, damage: current.damage + 0.5, range: current.range + 3 };
    case 'bow': return { ...current, burstSize: current.burstSize + 1 };
    case 'wand': return { ...current, damage: current.damage + 1, explosionSize: current.explosionSize + 1 };
    case 'shield': return { ...current, shieldSize: current.shieldSize + 1 };
    case 'scythe': return current;
    case 'unarmed': return { ...current, maxSpeed: current.maxSpeed + 0.5 };
    case 'wrench': return current;
    case 'katana': return { ...current, cutCount: current.cutCount + 1 };
  }
}

export function progressionLabel(type: WeaponType, progress: WeaponProgress): string {
  switch (type) {
    case 'sword': return `DAÑO ${format(progress.damage)}`;
    case 'dagger': return `GIRO ${format(progress.angularSpeed)}×`;
    case 'spear': return `DAÑO ${format(progress.damage)} · RANGO ${format(progress.range)}`;
    case 'bow': return `RÁFAGA ×${progress.burstSize}`;
    case 'wand': return `DAÑO ${format(progress.damage)} · EXPLOSIÓN ${progress.explosionSize}`;
    case 'shield': return `ESCUDO ${progress.shieldSize}`;
    case 'scythe': return 'VENENO +1';
    case 'unarmed': return `VEL. MÁX ${format(progress.maxSpeed)}`;
    case 'wrench': return 'TORRETA ACTIVA';
    case 'katana': return `CORTES ×${progress.cutCount}`;
  }
}

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export class ContactCooldowns {
  private readonly contacts = new Map<string, number>();

  canTrigger(attackerId: string, targetId: string, now: number, cooldownMs: number): boolean {
    const key = `${attackerId}>${targetId}`;
    const previous = this.contacts.get(key) ?? -Infinity;
    if (now - previous < cooldownMs) return false;
    this.contacts.set(key, now);
    return true;
  }

  clearFor(fighterId: string): void {
    for (const key of this.contacts.keys()) {
      if (key.includes(fighterId)) this.contacts.delete(key);
    }
  }
}
