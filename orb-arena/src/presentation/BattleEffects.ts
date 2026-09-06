import type Phaser from 'phaser';
import type { SeededRandom } from '../utils/seededRandom';

/** Decorative work is bounded; no combatant, projectile or gameplay timer is dropped. */
export class BattleEffects {
  activeParticles = 0;
  activeLabels = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly random: SeededRandom) {}

  spark(x: number, y: number, color: number, count: number, enabled: boolean): void {
    for (let index = 0; index < count; index += 1) {
      // Preserve the existing enabled-effects RNG sequence, even when hidden or saturated.
      const angle = this.random.between(0, Math.PI * 2);
      const distance = this.random.between(20, 65);
      const radius = this.random.between(1.5, 3.5);
      const duration = this.random.between(220, 520);
      if (!enabled || this.activeParticles >= 200) continue;
      this.activeParticles += 1;
      const particle = this.scene.add.circle(x, y, radius, color, 0.9).setDepth(19);
      this.scene.tweens.add({
        targets: particle, x: x + Math.cos(angle) * distance, y: y + Math.sin(angle) * distance,
        alpha: 0, scale: 0.2, duration, ease: 'Quad.easeOut',
        onComplete: () => { particle.destroy(); this.activeParticles -= 1; },
      });
    }
  }

  floatText(x: number, y: number, text: string, color: string, compact: boolean): void {
    if (this.activeLabels >= 40) return;
    this.activeLabels += 1;
    const label = this.scene.add.text(x, y, text, {
      fontFamily: 'ui-monospace, monospace', fontSize: compact ? '11px' : '17px', fontStyle: 'bold', color,
      stroke: '#080a10', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(20);
    this.scene.tweens.add({
      targets: label, y: y - 38, alpha: 0, duration: compact ? 700 : 520, ease: 'Cubic.easeOut',
      onComplete: () => { label.destroy(); this.activeLabels -= 1; },
    });
  }
}
