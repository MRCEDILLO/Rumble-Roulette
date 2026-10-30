import { describe, expect, it } from 'vitest';
import type { GameContext } from '../types';
import { REDRAW_MS, choosePickers, firstLastLogic as logic, type FirstLastState } from './logic';

const ref = { id: 'h', name: 'Host' };
const person = (id: string) => ({ id, name: id.toUpperCase() });
const ctx = (audience: string[]): GameContext => ({ ref, audience: audience.map(person) });

/** Fill both letters as whoever is picking them. */
function pick(s: FirstLastState, first = 'F', last = 'T', now = 0) {
  for (const [slot, letter] of [[0, first], [1, last]] as const) {
    const p = s.pickers[slot];
    s = logic.onInput(s, p.host ? 'ref' : 'audience', { action: 'letter', slot, letter }, now, Math.random, p.id);
  }
  return s;
}

describe('who picks the letters', () => {
  it('3 players: the Host picks both', () => {
    const [a, b] = choosePickers(ctx([]), Math.random);
    expect([a.id, b.id]).toEqual(['h', 'h']);
  });

  it('4 players: the Host and the audience member pick one each', () => {
    const ids = choosePickers(ctx(['x']), Math.random).map((p) => p.id);
    expect(ids.sort()).toEqual(['h', 'x']);
  });

  it('5+ players: two different audience members, never the Host', () => {
    for (let i = 0; i < 50; i++) {
      const [a, b] = choosePickers(ctx(['x', 'y', 'z']), Math.random);
      expect(a.id).not.toBe(b.id);
      expect([a.host, b.host]).toEqual([false, false]);
    }
  });
});

describe('First and Last', () => {
  it('only the picker can pick their letter, and letters stay hidden until both are in', () => {
    let s = logic.init(0, Math.random, ctx(['x', 'y']));
    const [p0] = s.pickers;
    const other = p0.id === 'x' ? 'y' : 'x';
    expect(logic.onInput(s, 'audience', { action: 'letter', slot: 0, letter: 'F' }, 0, Math.random, other)).toBe(s);
    expect(logic.onInput(s, 'a', { action: 'letter', slot: 0, letter: 'F' }, 0, Math.random, 'a')).toBe(s);
    s = logic.onInput(s, 'audience', { action: 'letter', slot: 0, letter: 'f' }, 0, Math.random, p0.id);
    expect(logic.project(s).letters).toEqual([null, null]);
    expect(logic.project(s).picked).toEqual([true, false]);
    s = pick(s);
    expect(s.status).toBe('open');
    expect(logic.project(s).letters).toEqual(['F', 'T']);
  });

  it('the Host can fill in a random letter for someone who is not picking', () => {
    let s = logic.init(0, Math.random, ctx(['x', 'y']));
    s = logic.onInput(s, 'ref', { action: 'letter', slot: 1, letter: 'A', random: true }, 0, Math.random, 'h');
    expect(s.letters[1]).toMatch(/^[A-Z]$/);
  });

  it('first buzz answers; correct wins', () => {
    let s = pick(logic.init(0, Math.random, ctx([])));
    s = logic.onInput(s, 'b', { action: 'buzz' }, 0, Math.random);
    s = logic.onInput(s, 'a', { action: 'buzz' }, 0, Math.random);
    expect(s.buzzer).toBe('b');
    s = logic.onInput(s, 'ref', { action: 'judge', correct: true }, 0, Math.random);
    expect(logic.result(s)).toBe('b');
  });

  it('wrong gives the other player a go; both wrong means new letters', () => {
    let s = pick(logic.init(0, Math.random, ctx([])));
    s = logic.onInput(s, 'a', { action: 'buzz' }, 0, Math.random);
    s = logic.onInput(s, 'ref', { action: 'judge', correct: false }, 0, Math.random);
    expect(s.status).toBe('steal');
    expect(s.buzzer).toBe('b');
    expect(logic.result(s)).toBeNull();
    s = logic.onInput(s, 'ref', { action: 'judge', correct: false }, 0, Math.random);
    expect(s.status).toBe('missed');
    s = logic.onInput(s, 'ref', { action: 'redraw' }, 0, Math.random);
    expect(s.status).toBe('choosing');
    expect(s.number).toBe(2);
    expect(s.letters).toEqual([null, null]);
  });

  it('the stealing player can win', () => {
    let s = pick(logic.init(0, Math.random, ctx([])));
    s = logic.onInput(s, 'a', { action: 'buzz' }, 0, Math.random);
    s = logic.onInput(s, 'ref', { action: 'judge', correct: false }, 0, Math.random);
    s = logic.onInput(s, 'ref', { action: 'judge', correct: true }, 0, Math.random);
    expect(logic.result(s)).toBe('b');
  });

  it('the Host can only redraw once the letters have been up for 10 seconds', () => {
    const s = pick(logic.init(0, Math.random, ctx([])), 'Q', 'X', 1000);
    expect(logic.onInput(s, 'ref', { action: 'redraw' }, 1000 + REDRAW_MS - 1, Math.random)).toBe(s);
    expect(logic.onInput(s, 'ref', { action: 'redraw' }, 1000 + REDRAW_MS, Math.random).status).toBe('choosing');
  });
});
