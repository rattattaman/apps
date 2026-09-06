import { afterEach, expect, it, vi } from 'vitest';
import { loadPreferences, savePreferences } from './preferences';
afterEach(() => vi.unstubAllGlobals());
it('conserva preferencias válidas, acota volumen y no toca estadísticas', () => {
  const store = new Map([['orb-arena-stats-v1','{"battles":9}'],['orb-arena-preferences-v1','{"music":2,"effects":0.2,"reduced":true}']]);
  vi.stubGlobal('localStorage', { getItem:(k:string)=>store.get(k)??null, setItem:(k:string,v:string)=>store.set(k,v) });
  const prefs = loadPreferences(); expect(prefs).toEqual({music:1,effects:.2,reduced:true,muted:false});
  savePreferences({...prefs,music:.1}); expect(loadPreferences().music).toBe(.1);
  expect(store.get('orb-arena-stats-v1')).toBe('{"battles":9}');
});
it('tolera almacenamiento bloqueado', () => {
  vi.stubGlobal('localStorage',{getItem:()=>{throw Error();},setItem:()=>{throw Error();}});
  expect(loadPreferences().music).toBe(.12); expect(()=>savePreferences(loadPreferences())).not.toThrow();
});
