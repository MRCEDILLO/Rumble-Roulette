import { describe, expect, it } from 'vitest';
import { MAX_MISSES, REVEAL_MS, WRITE_MS, cleanWord, hangmanLogic as logic, type HangmanState } from './logic';

const rng = () => 0;

/** Both duelists write a word and the Host approves both. a writes for b, b writes for a. */
function ready(forB = 'APPLE', forA = 'ZEBRA') {
  let s = logic.init(0, rng);
  s = logic.onInput(s, 'a', { action: 'word', word: forB }, 0, rng);
  s = logic.onInput(s, 'b', { action: 'word', word: forA }, 0, rng);
  s = logic.onInput(s, 'ref', { action: 'check', side: 'a', ok: true }, 0, rng);
  s = logic.onInput(s, 'ref', { action: 'check', side: 'b', ok: true }, 0, rng);
  return s;
}

function guess(s: HangmanState, side: 'a' | 'b', letters: string) {
  for (const letter of letters) s = logic.onInput(s, side, { action: 'guess', letter }, 1000, rng);
  return s;
}

/** Let the reveal play out. */
const settle = (s: HangmanState) => logic.tick!(s, 1000 + REVEAL_MS, rng);

describe('word rules', () => {
  it('one word, letters only, 3 to 20 long', () => {
    expect(cleanWord(' pizza ')).toBe('PIZZA');
    expect(cleanWord('ice cream')).toBeNull();
    expect(cleanWord('rock&roll')).toBeNull();
    expect(cleanWord('café')).toBeNull();
    expect(cleanWord('ab')).toBeNull();
    expect(cleanWord('a'.repeat(20))).toBe('A'.repeat(20));
    expect(cleanWord('a'.repeat(21))).toBeNull();
  });
});

describe('Hangman', () => {
  it('the race only starts once the Host has approved both words', () => {
    let s = logic.init(0, rng);
    s = logic.onInput(s, 'a', { action: 'word', word: 'apple' }, 0, rng);
    s = logic.onInput(s, 'b', { action: 'word', word: 'zebra' }, 0, rng);
    s = logic.onInput(s, 'ref', { action: 'check', side: 'a', ok: true }, 0, rng);
    expect(s.status).toBe('writing');
    s = logic.onInput(s, 'ref', { action: 'check', side: 'b', ok: true }, 0, rng);
    expect(s.status).toBe('guessing');
  });

  it('a word the Host sends back has to be typed again', () => {
    let s = logic.init(0, rng);
    s = logic.onInput(s, 'a', { action: 'word', word: 'qzxqzx' }, 0, rng);
    s = logic.onInput(s, 'ref', { action: 'check', side: 'a', ok: false }, 50_000, rng);
    expect(s.words.a).toBeNull();
    expect(s.rejected.a).toBe(true);
    expect(s.writeEndsAt).toBeGreaterThan(50_000 + 20_000);
    s = logic.onInput(s, 'a', { action: 'word', word: 'apple' }, 0, rng);
    expect(s.words.a).toBe('APPLE');
  });

  it('nobody can see the words while racing', () => {
    const s = ready();
    const v = logic.project(s);
    expect(v.words).toEqual({ a: null, b: null });
    expect(JSON.stringify(v)).not.toContain('APPLE');
    expect(JSON.stringify(v)).not.toContain('ZEBRA');
  });

  it('out of time: a spare word is picked and the race starts', () => {
    let s = logic.init(0, rng);
    s = logic.onInput(s, 'a', { action: 'word', word: 'apple' }, 0, rng);
    s = logic.onInput(s, 'ref', { action: 'check', side: 'a', ok: true }, 0, rng);
    s = logic.tick!(s, WRITE_MS, rng);
    expect(s.status).toBe('guessing');
    expect(s.spare.b).toBe(true);
    expect(s.words.b).toMatch(/^[A-Z]+$/);
  });

  it('each duelist guesses the word the other one wrote', () => {
    let s = ready('APPLE', 'ZEBRA');
    s = guess(s, 'b', 'P');
    expect(logic.project(s).boards!.b.pattern).toEqual([null, 'P', 'P', null, null]);
    s = guess(s, 'a', 'Z');
    expect(logic.project(s).boards!.a.pattern[0]).toBe('Z');
  });

  it('first to solve wins', () => {
    let s = ready('APPLE', 'ZEBRA');
    s = guess(s, 'a', 'ZEBR');
    s = guess(s, 'b', 'APLE');
    expect(s.status).toBe('reveal');
    expect(logic.result(settle(s))).toBe('b');
    // Too late for a.
    expect(guess(s, 'a', 'A')).toBe(s);
  });

  it(`${MAX_MISSES} misses and you're out; the other one still has to solve it`, () => {
    let s = ready('APPLE', 'ZEBRA');
    s = guess(s, 'a', 'CDFGHI');
    expect(logic.project(s).boards!.a.hanged).toBe(true);
    expect(s.status).toBe('guessing');
    expect(guess(s, 'a', 'Z')).toBe(s);
    s = guess(s, 'b', 'APLE');
    expect(logic.result(settle(s))).toBe('b');
  });

  it('both hanged is a draw', () => {
    let s = ready('APPLE', 'ZEBRA');
    s = guess(s, 'a', 'CDFGHI');
    s = guess(s, 'b', 'BCDFGH');
    expect(logic.result(settle(s))).toBe('draw');
  });

  it('a letter only counts once', () => {
    let s = ready('APPLE', 'ZEBRA');
    s = guess(s, 'a', 'QQQQQQ');
    expect(logic.project(s).boards!.a.misses).toEqual(['Q']);
  });
});
