import type { FighterHudState } from '../events';

interface Card {
  element: HTMLElement;
  name: HTMLElement;
  detail: HTMLElement;
  health: HTMLElement;
  bar: HTMLElement;
}

function text(element: HTMLElement, value: string): void {
  if (element.textContent !== value) element.textContent = value;
}

export class Scoreboard {
  private readonly cards = new Map<string, Card>();
  constructor(private readonly container: HTMLElement) {}

  render(states: FighterHudState[]): void {
    this.container.style.setProperty('--fighter-count', String(states.length));
    const ids = new Set(states.map((fighter) => fighter.id));
    for (const [id, card] of this.cards) if (!ids.has(id)) {
      card.element.remove();
      this.cards.delete(id);
    }
    for (const fighter of states) {
      let card = this.cards.get(fighter.id);
      if (!card) {
        const element = document.createElement('article');
        element.className = 'fighter-card';
        element.innerHTML = '<span class="fighter-swatch"></span><span class="fighter-card-copy"><b></b><small></small></span><span class="health"><b></b><span><i></i></span></span>';
        card = {
          element, name: element.querySelector('.fighter-card-copy b')!,
          detail: element.querySelector('small')!, health: element.querySelector('.health b')!,
          bar: element.querySelector('i')!,
        };
        this.cards.set(fighter.id, card);
        this.container.append(element);
      }
      card.element.classList.toggle('eliminated', !fighter.alive);
      if (card.element.style.getPropertyValue('--fighter-color') !== fighter.colorCss) card.element.style.setProperty('--fighter-color', fighter.colorCss);
      text(card.name, (fighter.team ? fighter.team + ' · ' : '') + fighter.name);
      text(card.detail, `${fighter.weaponName} · ${fighter.stat}`);
      text(card.health, String(Math.ceil(fighter.health)));
      const width = `${Math.min(100, Math.max(0, fighter.health / fighter.maxHealth * 100))}%`;
      if (card.bar.style.width !== width) card.bar.style.width = width;
    }
  }
}
