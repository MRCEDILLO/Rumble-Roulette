import { describe, expect, it } from 'vitest';
import { MAX, MIN, NUMBERS, REVEAL_MS, formatNumber, whatsMyNumberLogic as logic } from './logic';

describe('What’s my Number', () => {
  it('gives the duelists different numbers in range, and starts straight away', () => {
    for (let i = 0; i < 200; i++) {
      const s = logic.init(0, Math.random);
      expect(s.status).toBe('asking');
      expect(s.numbers.a).not.toBe(s.numbers.b);
      for (const n of [s.numbers.a, s.numbers.b]) {
        expect(Number.isInteger(n)).toBe(true);
        expect(NUMBERS).toContain(n);
      }
    }
  });

  it('has every number to 100, then only round ones, rounder as they grow', () => {
    expect(MIN).toBe(1);
    expect(MAX).toBe(1_000_000);
    expect(new Set(NUMBERS).size).toBe(NUMBERS.length);
    for (let n = 1; n <= 100; n++) expect(NUMBERS).toContain(n);
    for (const n of NUMBERS.filter((n) => n > 100)) {
      expect(n % (n <= 1_000 ? 50 : n <= 10_000 ? 500 : n <= 100_000 ? 5_000 : 50_000)).toBe(0);
    }
    expect(NUMBERS).toContain(250);
    expect(NUMBERS).not.toContain(251);
    expect(formatNumber(250_000)).toBe('250,000');
  });

  it('can land on both ends of the range', () => {
    const seq = (...xs: number[]) => () => xs.shift() ?? 0.5;
    expect(logic.init(0, seq(0, 0, 0.9999)).numbers).toEqual({ a: MIN, b: MAX });
  });

  it('has no redraw', () => {
    const s = logic.init(0, Math.random);
    expect(logic.onInput(s, 'ref', { action: 'redraw', side: 'a' }, 0, Math.random)).toBe(s);
  });

  it('only the Host can pick the winner', () => {
    const s = logic.init(0, Math.random);
    for (const role of ['a', 'b', 'audience'] as const) {
      expect(logic.onInput(s, role, { action: 'guessed', side: 'a' }, 0, Math.random)).toBe(s);
    }
  });

  it('the Host picks who guessed it, both numbers show, then the result is in', () => {
    let s = logic.onInput(logic.init(0, Math.random), 'ref', { action: 'guessed', side: 'a' }, 1000, Math.random);
    expect(s.status).toBe('reveal');
    expect(logic.result(s)).toBeNull();
    expect(logic.onInput(s, 'ref', { action: 'guessed', side: 'b' }, 1001, Math.random)).toBe(s);
    expect(logic.tick!(s, 1000 + REVEAL_MS - 1, Math.random).status).toBe('reveal');
    s = logic.tick!(s, 1000 + REVEAL_MS, Math.random);
    expect(logic.result(s)).toBe('a');
  });
});
