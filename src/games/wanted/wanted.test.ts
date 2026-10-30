import { describe, expect, it } from 'vitest';
import { CROWD, LOCKOUT_MS, NEAR_MISSES, REVEAL_MS, ROUND_REVEAL_MS, SCENES, TIME_MS, wantedLogic as logic, type WantedState } from './logic';

const tap = (s: WantedState, side: 'a' | 'b', person: number, now = 0) => logic.onInput(s, side, { action: 'tap', person }, now, Math.random);
const wrongOne = (s: WantedState, skip: number[] = []) => s.crowd.findIndex((_, i) => i !== s.target && !skip.includes(i));

describe('WANTED', () => {
  it('only one person in the crowd matches the poster, with near misses around them', () => {
    for (let n = 0; n < 300; n++) {
      const s = logic.init(0, Math.random);
      expect(s.crowd).toHaveLength(CROWD);
      const matches = s.crowd.filter((p) => p.color === s.wanted.color && p.accessory === s.wanted.accessory);
      expect(matches).toHaveLength(1);
      expect(s.crowd[s.target]).toBe(matches[0]);
      expect(s.crowd.filter((p) => p.color === s.wanted.color).length).toBeGreaterThan(NEAR_MISSES);
      expect(s.crowd.filter((p) => p.accessory === s.wanted.accessory).length).toBeGreaterThan(NEAR_MISSES);
      expect(SCENES).toContain(s.scene);
      for (const p of s.crowd) {
        for (const v of [p.x, p.y]) {
          expect(v).toBeGreaterThan(-0.05);
          expect(v).toBeLessThan(1);
        }
      }
    }
  });

  it('hides who the wanted one is from phones until the reveal', () => {
    const s = logic.init(0, Math.random);
    expect(logic.project(s).target).toBeNull();
    const won = tap(s, 'a', s.target);
    expect(won.status).toBe('found');
    expect(logic.project(won).target).toBe(s.target);
  });

  it('is best of 3: first to 2 finds wins, with a new crowd each round', () => {
    let s = logic.init(0, Math.random);
    const first = s.crowd;
    s = tap(s, 'b', s.target, 100);
    expect(s.status).toBe('found');
    expect(s.wins).toEqual({ a: 0, b: 1 });
    expect(tap(s, 'a', s.target, 200)).toBe(s);
    expect(logic.result(s)).toBeNull();
    s = logic.tick!(s, 100 + ROUND_REVEAL_MS, Math.random);
    expect(s.status).toBe('playing');
    expect(s.round).toBe(2);
    expect(s.crowd).not.toBe(first);
    s = tap(s, 'a', s.target, 5000);
    s = logic.tick!(s, 5000 + ROUND_REVEAL_MS, Math.random);
    expect(s.round).toBe(3);
    s = tap(s, 'b', s.target, 9000);
    expect(s.winner).toBe('b');
    expect(logic.result(s)).toBeNull();
    s = logic.tick!(s, 9000 + REVEAL_MS, Math.random);
    expect(logic.result(s)).toBe('b');
  });

  it('2–0 ends the duel early', () => {
    let s = logic.init(0, Math.random);
    s = logic.tick!(tap(s, 'a', s.target, 0), ROUND_REVEAL_MS, Math.random);
    s = tap(s, 'a', s.target, ROUND_REVEAL_MS);
    s = logic.tick!(s, ROUND_REVEAL_MS + REVEAL_MS, Math.random);
    expect(logic.result(s)).toBe('a');
  });

  it('a wrong tap freezes only that duelist for a few seconds', () => {
    let s = logic.init(0, Math.random);
    const miss = wrongOne(s);
    s = tap(s, 'a', miss, 1000);
    expect(s.misses.a).toEqual([miss]);
    expect(s.status).toBe('playing');
    expect(tap(s, 'a', s.target, 1000 + LOCKOUT_MS - 1)).toBe(s);
    expect(tap(s, 'a', s.target, 1000 + LOCKOUT_MS).roundWinner).toBe('a');
    expect(tap(s, 'b', s.target, 1001).roundWinner).toBe('b');
  });

  it('only the duelists can tap, and only real people', () => {
    const s = logic.init(0, Math.random);
    expect(logic.onInput(s, 'ref', { action: 'tap', person: s.target }, 0, Math.random)).toBe(s);
    expect(logic.onInput(s, 'audience', { action: 'tap', person: s.target }, 0, Math.random)).toBe(s);
    expect(tap(s, 'a', CROWD)).toBe(s);
    expect(tap(s, 'a', -1)).toBe(s);
  });

  it('nobody finding them in time gives no point and replays the round', () => {
    let s = logic.init(0, Math.random);
    const first = s.crowd;
    s = logic.tick!(s, TIME_MS, Math.random);
    expect(s.status).toBe('found');
    expect(s.roundWinner).toBeNull();
    s = logic.tick!(s, TIME_MS + ROUND_REVEAL_MS, Math.random);
    expect(s.status).toBe('playing');
    expect(s.round).toBe(1);
    expect(s.wins).toEqual({ a: 0, b: 0 });
    expect(s.crowd).not.toBe(first);
  });

  it('freezes and crossed-out people reset each round', () => {
    let s = logic.init(0, Math.random);
    s = tap(s, 'a', wrongOne(s), 0);
    s = logic.tick!(tap(s, 'b', s.target, 10), 10 + ROUND_REVEAL_MS, Math.random);
    expect(s.misses).toEqual({ a: [], b: [] });
    expect(s.lockedUntil).toEqual({ a: 0, b: 0 });
  });
});
