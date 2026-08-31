import { CHAOS } from '../config/balance';
import type { SeededRandom } from '../utils/seededRandom';

export interface ChaosHost {
  announceChaos(name: string, detail: string): void;
  shrinkArena(amount: number): void;
  setTemporaryGravity(x: number, y: number, durationMs: number): void;
  growWeapons(factor: number): void;
  setProjectileMultiplier(multiplier: number, durationMs: number): void;
  reverseSpin(): void;
  setBounceHealing(enabled: boolean, durationMs: number): void;
  activateSuddenDeath(): void;
  increaseGlobalSpeed(factor: number): void;
}

interface ChaosModifier {
  name: string;
  detail: string;
  apply(host: ChaosHost, random: SeededRandom): void;
}

export function createChaosGravity(random: Pick<SeededRandom, 'between'>): { x: number; y: number } {
  const angle = random.between(0, Math.PI * 2);
  const strength = random.between(1.65, 2.25);
  return { x: Math.cos(angle) * strength, y: Math.sin(angle) * strength };
}

const MODIFIERS: ChaosModifier[] = [
  { name: 'MUROS HAMBRIENTOS', detail: 'La arena se encoge', apply: (host) => host.shrinkArena(18) },
  {
    name: 'GRAVEDAD ROTA',
    detail: 'Una gravedad intensa cambia de dirección',
    apply: (host, random) => {
      const gravity = createChaosGravity(random);
      host.setTemporaryGravity(gravity.x, gravity.y, CHAOS.temporaryDurationMs);
    },
  },
  { name: 'ACERO VIVO', detail: 'Todas las armas crecen', apply: (host) => host.growWeapons(1.13) },
  { name: 'ECO DE FLECHAS', detail: 'Los proyectiles se duplican', apply: (host) => host.setProjectileMultiplier(2, CHAOS.temporaryDurationMs) },
  { name: 'GIRO INVERSO', detail: 'Las órbitas cambian de sentido', apply: (host) => host.reverseSpin() },
  { name: 'REBOTE VITAL', detail: 'Los choques pueden curar', apply: (host) => host.setBounceHealing(true, CHAOS.temporaryDurationMs) },
  { name: 'MUERTE SÚBITA', detail: 'Todo el daño se duplica', apply: (host) => host.activateSuddenDeath() },
  { name: 'SOBRECARGA', detail: 'La velocidad global aumenta', apply: (host) => host.increaseGlobalSpeed(1.12) },
];

export class ChaosController {
  private deck: ChaosModifier[];
  private nextEventAt = CHAOS.firstEventMs;

  constructor(
    private readonly host: ChaosHost,
    private readonly random: SeededRandom,
  ) {
    this.deck = this.shuffledDeck();
  }

  update(elapsedMs: number): void {
    if (elapsedMs < this.nextEventAt) return;
    this.nextEventAt += CHAOS.eventIntervalMs;
    const modifier = this.deck.shift();
    if (!modifier) {
      this.deck = this.shuffledDeck();
      return this.update(elapsedMs);
    }
    this.host.announceChaos(modifier.name, modifier.detail);
    modifier.apply(this.host, this.random);
  }

  private shuffledDeck(): ChaosModifier[] {
    const copy = [...MODIFIERS];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const target = this.random.integer(0, index);
      [copy[index], copy[target]] = [copy[target] as ChaosModifier, copy[index] as ChaosModifier];
    }
    return copy;
  }
}
