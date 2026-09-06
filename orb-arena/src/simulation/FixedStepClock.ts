/** One clock for physics, combat and scene timers. Rendering never advances rules. */
export class FixedStepClock {
  static readonly stepMs = 1000 / 60;
  now = 0;
  private accumulatedMs = 0;

  get pendingMs(): number { return this.accumulatedMs; }

  reset(): void {
    this.now = 0;
    this.accumulatedMs = 0;
  }

  advance(deltaMs: number, speed: number, tick: (now: number, deltaMs: number) => void): number {
    if (!Number.isFinite(deltaMs) || deltaMs < 0 || !Number.isFinite(speed) || speed <= 0) return 0;
    this.accumulatedMs += deltaMs * speed;
    let steps = 0;
    // Bound work per rendered frame, retaining ALL debt when the device is overloaded.
    while (this.accumulatedMs + 1e-7 >= FixedStepClock.stepMs && steps < 8) {
      this.accumulatedMs = Math.max(0, this.accumulatedMs - FixedStepClock.stepMs);
      this.now += FixedStepClock.stepMs;
      tick(this.now, FixedStepClock.stepMs);
      steps += 1;
    }
    return steps;
  }
}
