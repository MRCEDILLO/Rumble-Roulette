import { beforeEach, describe, expect, it } from 'vitest';
import { resetTriviaMemory } from '../trivia/deck';
import { CELEBRITIES, parseCharacters } from './bank';
import { REVEAL_MS, celebrityHeadsLogic as logic } from './logic';

beforeEach(() => resetTriviaMemory());

describe('Celebrity Heads characters', () => {
  it('has a big list with no repeats, of both real people and fictional characters', () => {
    expect(CELEBRITIES.length).toBeGreaterThanOrEqual(300);
    expect(new Set(CELEBRITIES.map((c) => c.id)).size).toBe(CELEBRITIES.length);
    expect(CELEBRITIES.some((c) => c.real)).toBe(true);
    expect(CELEBRITIES.some((c) => !c.real)).toBe(true);
    expect(CELEBRITIES.every((c) => c.knownFor)).toBe(true);
  });

  it('reads the file and skips repeats', () => {
    const list = parseCharacters('name,type,known_for\nYoda,fictional,Star Wars\nyoda,fictional,again\nPelé,real,Footballer\n');
    expect(list.map((c) => [c.name, c.real])).toEqual([
      ['Yoda', false],
      ['Pelé', true],
    ]);
  });
});

describe('Celebrity Heads', () => {
  it('gives the duelists different characters, and redraws keep them different', () => {
    let s = logic.init(0, Math.random);
    expect(s.status).toBe('drawing');
    for (let i = 0; i < 50; i++) {
      expect(s.characters.a.id).not.toBe(s.characters.b.id);
      const before = s.characters.b;
      s = logic.onInput(s, 'ref', { action: 'redraw', side: i % 2 ? 'a' : 'b' }, 0, Math.random);
      if (i % 2 === 0) expect(s.characters.b).not.toBe(before);
    }
  });

  it('only the Host can redraw, start and pick the winner', () => {
    let s = logic.init(0, Math.random);
    for (const role of ['a', 'b', 'audience'] as const) {
      expect(logic.onInput(s, role, { action: 'begin' }, 0, Math.random)).toBe(s);
      expect(logic.onInput(s, role, { action: 'redraw', side: 'a' }, 0, Math.random)).toBe(s);
    }
    s = logic.onInput(s, 'ref', { action: 'begin' }, 0, Math.random);
    expect(s.status).toBe('asking');
    expect(logic.onInput(s, 'a', { action: 'guessed', side: 'a' }, 0, Math.random)).toBe(s);
  });

  it('no redraws once the asking starts', () => {
    let s = logic.onInput(logic.init(0, Math.random), 'ref', { action: 'begin' }, 0, Math.random);
    expect(logic.onInput(s, 'ref', { action: 'redraw', side: 'a' }, 0, Math.random)).toBe(s);
  });

  it('the Host picks who guessed it, both characters show, then the result is in', () => {
    let s = logic.init(0, Math.random);
    expect(logic.onInput(s, 'ref', { action: 'guessed', side: 'b' }, 0, Math.random)).toBe(s);
    s = logic.onInput(s, 'ref', { action: 'begin' }, 0, Math.random);
    s = logic.onInput(s, 'ref', { action: 'guessed', side: 'b' }, 1000, Math.random);
    expect(s.status).toBe('reveal');
    expect(logic.result(s)).toBeNull();
    expect(logic.tick!(s, 1000 + REVEAL_MS - 1, Math.random).status).toBe('reveal');
    s = logic.tick!(s, 1000 + REVEAL_MS, Math.random);
    expect(logic.result(s)).toBe('b');
  });
});
