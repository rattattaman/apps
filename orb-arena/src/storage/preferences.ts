export interface Preferences { music: number; effects: number; reduced: boolean; muted: boolean }
export const DEFAULT_PREFERENCES: Preferences = { music: 0.12, effects: 0.5, reduced: false, muted: false };
const KEY = 'orb-arena-preferences-v1';
export function loadPreferences(): Preferences {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const volume = (v: unknown, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0,Math.min(1,v)) : fallback;
    return { music: volume(value.music, .12), effects: volume(value.effects, .5), reduced: value.reduced === true, muted: value.muted === true };
  } catch { return {...DEFAULT_PREFERENCES}; }
}
export function savePreferences(value: Preferences): void {
  try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* Private mode */ }
}
