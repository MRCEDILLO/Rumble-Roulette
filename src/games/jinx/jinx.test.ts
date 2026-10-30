import { beforeEach, describe, expect, it } from 'vitest';
import { resetTriviaMemory } from '../trivia/deck';
import type { GameContext } from '../types';
import { PROMPTS, RESULT_MS, THINK_MS, answersEach, cleanAnswer, jinxLogic as logic, parsePrompts, type JinxState } from './logic';

beforeEach(() => resetTriviaMemory());

const room = (audience: number): GameContext => ({
  ref: { id: 'h', name: 'Hana' },
  audience: Array.from({ length: audience }, (_, i) => ({ id: `p${i}`, name: `P${i}` })),
});

/** Everyone sends answers (made up from their id). */
function allAnswer(s: JinxState, now = 0) {
  for (const p of s.answerers) {
    const answers = Array.from({ length: s.each }, (_, i) => `${p.id}-${i}`);
    s = logic.onInput(s, p.host ? 'ref' : 'audience', { action: 'answers', answers }, now, Math.random, p.host ? undefined : p.id);
  }
  return s;
}

describe('Jinx! prompts', () => {
  it('has a big list of “Name a…” prompts with no repeats', () => {
    expect(PROMPTS.length).toBeGreaterThanOrEqual(300);
    expect(new Set(PROMPTS.map((p) => p.id)).size).toBe(PROMPTS.length);
    expect(PROMPTS.every((p) => p.text.startsWith('Name '))).toBe(true);
  });

  it('skips notes, blanks and repeats', () => {
    expect(parsePrompts('# note\n\nName a fruit\nname a fruit \nName a colour').map((p) => p.text)).toEqual(['Name a fruit', 'Name a colour']);
  });
});

describe('Jinx!', () => {
  it('the Host and the audience all write, more answers each in a small room', () => {
    expect([1, 2, 3, 8].map(answersEach)).toEqual([3, 2, 1, 1]);
    const three = logic.init(0, Math.random, room(0));
    expect(three.answerers.map((p) => [p.id, p.host])).toEqual([['h', true]]);
    expect(three.each).toBe(3);
    expect(logic.init(0, Math.random, room(1)).each).toBe(2);
    expect(logic.init(0, Math.random, room(4)).answerers).toHaveLength(5);
  });

  it('keeps answers hidden until the Host reveals them', () => {
    let s = logic.init(0, Math.random, room(2));
    expect(s.status).toBe('writing');
    s = logic.onInput(s, 'audience', { action: 'answers', answers: ['  Mint   choc '] }, 0, Math.random, 'p0');
    expect(s.answers.p0).toEqual(['Mint choc']);
    expect(logic.project(s).answers).toBeNull();
    expect(logic.project(s).done).toEqual(['p0']);
    s = allAnswer(s, 1000);
    expect(s.status).toBe('saying');
    expect(logic.project(s).answers).toBeNull();
    // Not before the duelists have had their countdown.
    expect(logic.onInput(s, 'ref', { action: 'reveal' }, 1000 + THINK_MS - 1, Math.random)).toBe(s);
    s = logic.onInput(s, 'ref', { action: 'reveal' }, 1000 + THINK_MS, Math.random);
    expect(s.status).toBe('reveal');
    expect(logic.project(s).answers?.p0).toEqual(['Mint choc']);
  });

  it('only takes the right number of real answers, once, from people who are writing', () => {
    const s = logic.init(0, Math.random, room(1));
    const send = (role: 'a' | 'ref' | 'audience', answers: unknown, seat?: string) => logic.onInput(s, role, { action: 'answers', answers }, 0, Math.random, seat);
    expect(send('audience', ['one'], 'p0')).toBe(s);
    expect(send('audience', ['one', '   '], 'p0')).toBe(s);
    expect(send('audience', ['one', 'two'], 'stranger')).toBe(s);
    expect(send('a', ['one', 'two'])).toBe(s);
    const once = send('audience', ['one', 'two'], 'p0');
    expect(logic.onInput(once, 'audience', { action: 'answers', answers: ['x', 'y'] }, 0, Math.random, 'p0')).toBe(once);
    expect(cleanAnswer('x'.repeat(50))).toHaveLength(30);
  });

  it('the Host can go on without someone, but not before anyone has answered', () => {
    let s = logic.init(0, Math.random, room(2));
    expect(logic.onInput(s, 'ref', { action: 'skip' }, 0, Math.random)).toBe(s);
    s = logic.onInput(s, 'audience', { action: 'answers', answers: ['a'] }, 0, Math.random, 'p1');
    expect(logic.onInput(s, 'audience', { action: 'skip' }, 0, Math.random, 'p1')).toBe(s);
    expect(logic.onInput(s, 'ref', { action: 'skip' }, 0, Math.random).status).toBe('saying');
  });

  function toReveal() {
    let s = allAnswer(logic.init(0, Math.random, room(2)));
    return logic.onInput(s, 'ref', { action: 'reveal' }, THINK_MS, Math.random);
  }

  it('whoever said the same as the audience loses', () => {
    let s = logic.onInput(toReveal(), 'ref', { action: 'judge', a: true, b: false }, 10_000, Math.random);
    expect(s.status).toBe('result');
    expect(logic.result(s)).toBeNull();
    s = logic.tick!(s, 10_000 + RESULT_MS, Math.random);
    expect(logic.result(s)).toBe('b');
    const t = logic.onInput(toReveal(), 'ref', { action: 'judge', a: false, b: true }, 0, Math.random);
    expect(t.winner).toBe('a');
  });

  it('both or neither the same: a new question, and only the Host judges', () => {
    for (const both of [true, false]) {
      let s = toReveal();
      expect(logic.onInput(s, 'a', { action: 'judge', a: true, b: false }, 0, Math.random)).toBe(s);
      s = logic.onInput(s, 'ref', { action: 'judge', a: both, b: both }, 0, Math.random);
      expect(s.status).toBe('replay');
      expect(logic.result(s)).toBeNull();
      const before = s.prompt.id;
      s = logic.onInput(s, 'ref', { action: 'next' }, 0, Math.random);
      expect(s.status).toBe('writing');
      expect(s.number).toBe(2);
      expect(s.answers).toEqual({});
      expect(s.prompt.id).not.toBe(before);
      expect(s.answerers).toHaveLength(3);
    }
  });
});
