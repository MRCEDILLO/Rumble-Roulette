import { beforeEach, describe, expect, it } from 'vitest';
import { resetTriviaMemory } from '../trivia/deck';
import { HINT_AT_MS, MISSED_MS, RESULT_MS, SOLVE_MS, WORDS, scramble, scrambleLogic as logic } from './logic';

const rng = () => 0;
const sort = (w: string) => w.split('').sort().join('');

beforeEach(() => resetTriviaMemory());

describe('word list', () => {
  it('has everyday-length words with no repeats and no shared jumbles', () => {
    expect(WORDS.length).toBeGreaterThan(150);
    for (const w of WORDS) expect(w.text).toMatch(/^[A-Z]{5,9}$/);
    // Two words with the same letters would make a jumble ambiguous.
    const keys = WORDS.map((w) => sort(w.text));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('scramble', () => {
  it('uses the same letters, never spells the word and never starts with its first letter', () => {
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const w of WORDS) {
      const s = scramble(w.text, rand);
      expect(sort(s)).toBe(sort(w.text));
      expect(s).not.toBe(w.text);
      expect(s[0]).not.toBe(w.text[0]);
    }
  });
});

describe('Scramble', () => {
  it('hides the answer from phones until the word is over', () => {
    const s = logic.init(0, rng);
    const v = logic.project(s);
    expect(v.answer).toBeNull();
    expect(v.slots.every((l) => l === null)).toBe(true);
    expect(sort(v.letters)).toBe(sort(s.word.text));
  });

  it('first to type the word wins, any case, wrong guesses just count', () => {
    let s = logic.init(0, rng);
    const word = s.word.text;
    s = logic.onInput(s, 'a', { action: 'guess', text: 'nope' }, 100, rng);
    expect(s.wrong.a).toBe(1);
    expect(s.status).toBe('playing');
    s = logic.onInput(s, 'b', { action: 'guess', text: ` ${word.toLowerCase()} ` }, 200, rng);
    s = logic.onInput(s, 'a', { action: 'guess', text: word }, 201, rng);
    expect(s.winner).toBe('b');
    expect(logic.result(s)).toBeNull();
    s = logic.tick!(s, 200 + RESULT_MS, rng);
    expect(logic.result(s)).toBe('b');
    expect(logic.project(s).answer).toBe(word);
  });

  it('shows the first letter, then the last, as hints', () => {
    let s = logic.init(0, rng);
    const word = s.word.text;
    s = logic.tick!(s, HINT_AT_MS[0], rng);
    expect(logic.project(s).slots[0]).toBe(word[0]);
    expect(logic.project(s).slots.filter(Boolean)).toHaveLength(1);
    s = logic.tick!(s, HINT_AT_MS[1], rng);
    expect(logic.project(s).slots.at(-1)).toBe(word.at(-1));
    expect(logic.project(s).slots.filter(Boolean)).toHaveLength(2);
  });

  it('when time runs out, shows the word then deals a new one', () => {
    let s = logic.init(0, rng);
    const first = s.word.text;
    s = logic.tick!(s, SOLVE_MS, rng);
    expect(s.status).toBe('missed');
    expect(logic.result(s)).toBeNull();
    expect(logic.project(s).answer).toBe(first);
    // Guesses don't count while the answer is up.
    s = logic.onInput(s, 'a', { action: 'guess', text: first }, SOLVE_MS + 1, rng);
    expect(s.winner).toBeNull();
    s = logic.tick!(s, SOLVE_MS + MISSED_MS, rng);
    expect(s.status).toBe('playing');
    expect(s.word.text).not.toBe(first);
    expect(s.wordNo).toBe(2);
    expect(s.hints).toBe(0);
    expect(s.endsAt).toBe(SOLVE_MS + MISSED_MS + SOLVE_MS);
  });

  it('the Host can skip to a new word, but duelists and the audience cannot', () => {
    let s = logic.init(0, rng);
    expect(logic.onInput(s, 'a', { action: 'skip' }, 10, rng).status).toBe('playing');
    expect(logic.onInput(s, 'audience', { action: 'guess', text: s.word.text }, 10, rng).winner).toBeNull();
    s = logic.onInput(s, 'ref', { action: 'skip' }, 10, rng);
    expect(s.status).toBe('missed');
  });
});
