import { beforeEach, describe, expect, it } from 'vitest';
import { CATEGORIES, READ_MS, categoryClashLogic } from '../category-clash/logic';
import { resetTriviaMemory } from '../trivia/deck';
import { FORBIDDEN_CATEGORIES, LETTERS, forbiddenCategoriesLogic as logic, pickLetter } from './logic';

const rng = () => 0;

beforeEach(() => resetTriviaMemory());

describe('Forbidden Categories', () => {
  it('only bans letters that matter but leave the category playable', () => {
    expect(LETTERS).not.toContain('E');
    for (const rare of 'QZXJKVWFYB') expect(LETTERS).not.toContain(rare);
    expect(new Set(LETTERS).size).toBe(LETTERS.length);
  });

  it('leaves out the categories about spelling, which a banned letter could make impossible', () => {
    const texts = FORBIDDEN_CATEGORIES.map((c) => c.text);
    expect(texts).not.toContain('Words that start with S');
    expect(texts).not.toContain('Words that rhyme with cat');
    expect(texts).not.toContain('Words that end in ING');
    expect(texts).toContain('Words that mean happy');
    expect(texts).toContain('Fruits');
    expect(FORBIDDEN_CATEGORIES.length).toBeGreaterThanOrEqual(CATEGORIES.length - 12);
  });

  it('never picks the same letter twice in a row', () => {
    for (const l of LETTERS) {
      for (const r of [0, 0.5, 0.999]) expect(pickLetter(() => r, l)).not.toBe(l);
    }
  });

  it('draws a letter with the category, and the Host can swap either before the clocks start', () => {
    let s = logic.init(0, rng);
    expect(LETTERS).toContain(s.letter);
    const first = s.letter;
    s = logic.onInput(s, 'ref', { action: 'newLetter' }, 3000, rng);
    expect(s.letter).not.toBe(first);
    expect(s.number).toBe(1);
    // Swapping the letter gives fresh time to read.
    expect(logic.tick!(s, 3000 + READ_MS - 1, rng).status).toBe('reading');
    const letter = s.letter;
    s = logic.onInput(s, 'ref', { action: 'redraw' }, 4000, rng);
    expect(s.number).toBe(2);
    expect(s.letter).not.toBe(letter);
    s = logic.tick!(s, 4000 + READ_MS, rng);
    expect(s.status).toBe('running');
    expect(logic.onInput(s, 'ref', { action: 'newLetter' }, 9000, rng)).toBe(s);
    // Players can't swap it.
    expect(logic.onInput(logic.init(0, rng), 'a', { action: 'newLetter' }, 1, rng).letter).toBe('A');
  });

  it('leaves Category Clash without a letter', () => {
    const s = categoryClashLogic.init(0, rng);
    expect(s.letter).toBeNull();
    expect(categoryClashLogic.onInput(s, 'ref', { action: 'newLetter' }, 1000, rng)).toBe(s);
  });
});
