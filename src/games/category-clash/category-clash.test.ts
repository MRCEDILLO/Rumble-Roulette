import { beforeEach, describe, expect, it } from 'vitest';
import { resetTriviaMemory } from '../trivia/deck';
import { CATEGORIES, CLOCK_MS, READ_MS, RESULT_MS, categoryClashLogic as logic, timeLeft, type ClashState } from './logic';

const rng = () => 0;

beforeEach(() => resetTriviaMemory());

/** A duel with the clocks running, `a` to answer first. */
function started(): ClashState {
  const s = logic.init(0, rng);
  expect(s.turn).toBe('a');
  return logic.tick!(s, READ_MS, rng);
}

describe('categories', () => {
  it('has a big bank with no repeats', () => {
    expect(CATEGORIES.length).toBeGreaterThanOrEqual(300);
    expect(new Set(CATEGORIES.map((c) => c.id)).size).toBe(CATEGORIES.length);
  });
});

describe('Category Clash', () => {
  it('gives time to read, and the Host can swap the category before the clocks start', () => {
    let s = logic.init(0, rng);
    expect(s.status).toBe('reading');
    expect(logic.onInput(s, 'a', { action: 'pass' }, 1000, rng)).toBe(s);
    const first = s.category.id;
    s = logic.onInput(s, 'ref', { action: 'redraw' }, 2000, rng);
    expect(s.category.id).not.toBe(first);
    expect(s.number).toBe(2);
    expect(s.turn).toBe('a');
    expect(logic.tick!(s, 2000 + READ_MS - 1, rng).status).toBe('reading');
    s = logic.tick!(s, 2000 + READ_MS, rng);
    expect(s.status).toBe('running');
    expect(logic.onInput(s, 'ref', { action: 'redraw' }, 9000, rng)).toBe(s);
  });

  it('runs only the clock of whoever’s turn it is, like a chess clock', () => {
    let s = started();
    // Only the player whose turn it is can pass.
    expect(logic.onInput(s, 'b', { action: 'pass' }, READ_MS + 1000, rng)).toBe(s);
    s = logic.onInput(s, 'a', { action: 'pass' }, READ_MS + 4000, rng);
    expect(s.turn).toBe('b');
    expect(s.left.a).toBe(CLOCK_MS - 4000);
    expect(timeLeft(s, 'a', READ_MS + 10_000)).toBe(CLOCK_MS - 4000);
    expect(timeLeft(s, 'b', READ_MS + 10_000)).toBe(CLOCK_MS - 6000);
    s = logic.onInput(s, 'b', { action: 'pass' }, READ_MS + 6000, rng);
    expect(s.left).toEqual({ a: CLOCK_MS - 4000, b: CLOCK_MS - 2000 });
    expect(s.answers).toBe(2);
  });

  it('freezes both clocks while the Host checks an answer, then plays on', () => {
    let s = started();
    s = logic.onInput(s, 'a', { action: 'pass' }, READ_MS + 1000, rng);
    s = logic.onInput(s, 'ref', { action: 'pause' }, READ_MS + 3000, rng);
    expect(s.status).toBe('paused');
    // No passing while paused, and no time runs out.
    expect(logic.onInput(s, 'b', { action: 'pass' }, READ_MS + 4000, rng)).toBe(s);
    expect(logic.tick!(s, READ_MS + 99_000, rng)).toBe(s);
    s = logic.onInput(s, 'ref', { action: 'play' }, READ_MS + 60_000, rng);
    expect(s.turn).toBe('b');
    expect(timeLeft(s, 'b', READ_MS + 61_000)).toBe(CLOCK_MS - 3000);
  });

  it('lets the Host send the turn back when an answer doesn’t count', () => {
    let s = started();
    s = logic.onInput(s, 'a', { action: 'pass' }, READ_MS + 1000, rng);
    s = logic.onInput(s, 'ref', { action: 'pause' }, READ_MS + 2000, rng);
    s = logic.onInput(s, 'ref', { action: 'sendBack' }, READ_MS + 5000, rng);
    expect(s.status).toBe('running');
    expect(s.turn).toBe('a');
    expect(s.answers).toBe(0);
    // a's clock picks up where it stopped; b keeps the second it used.
    expect(timeLeft(s, 'a', READ_MS + 6000)).toBe(CLOCK_MS - 2000);
    expect(s.left.b).toBe(CLOCK_MS - 1000);
    // Only once per pass.
    s = logic.onInput(s, 'ref', { action: 'pause' }, READ_MS + 6000, rng);
    expect(logic.onInput(s, 'ref', { action: 'sendBack' }, READ_MS + 7000, rng)).toBe(s);
  });

  it('ends when a clock runs out: the other player wins', () => {
    let s = started();
    s = logic.tick!(s, READ_MS + CLOCK_MS - 1, rng);
    expect(s.status).toBe('running');
    s = logic.tick!(s, READ_MS + CLOCK_MS, rng);
    expect(s.status).toBe('result');
    expect(s.left.a).toBe(0);
    expect(logic.result(s)).toBeNull();
    s = logic.tick!(s, READ_MS + CLOCK_MS + RESULT_MS, rng);
    expect(logic.result(s)).toBe('b');
  });
});
