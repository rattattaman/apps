import { afterEach, expect, it, vi } from 'vitest';
import { ArcadeMusic } from './ArcadeMusic';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('inicia tras interacción, no duplica secuenciadores y libera al pausar', () => {
  vi.useFakeTimers(); vi.stubGlobal('window',globalThis);
  const oscillators: {stop: ReturnType<typeof vi.fn>}[] = [];
  class Context {
    currentTime=0; state='running'; destination={};
    resume=vi.fn(async()=>{}); suspend=vi.fn(async()=>{}); close=vi.fn(async()=>{});
    createDynamicsCompressor(){return {threshold:{value:0},knee:{value:0},ratio:{value:0},attack:{value:0},release:{value:0},connect:vi.fn(),disconnect:vi.fn()};}
    createGain(){return {gain:{value:0,setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn()},connect:vi.fn(),disconnect:vi.fn()};}
    createOscillator(){const o={frequency:{value:0},type:'sine',connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn(),onended:null};oscillators.push(o);return o;}
  }
  const construct = vi.fn(function(){return new Context();}); vi.stubGlobal('AudioContext',construct);
  const music=new ArcadeMusic(); expect(construct).not.toHaveBeenCalled();
  music.start(); music.start(); expect(vi.getTimerCount()).toBe(1); expect(construct).toHaveBeenCalledTimes(1);
  music.pause(); expect(vi.getTimerCount()).toBe(0); expect(oscillators.every(o=>o.stop.mock.calls.length>=2)).toBe(true);
  music.start(); expect(vi.getTimerCount()).toBe(1); music.destroy(); expect(vi.getTimerCount()).toBe(0);
});
