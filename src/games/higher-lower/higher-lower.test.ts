import { beforeEach, describe, expect, it } from 'vitest';
import { connectTriviaMemory, resetTriviaMemory } from '../trivia/deck';
import { NUMBER_QUESTIONS, formatNumber, parseGuess, parseNumberQuestions } from './bank';
import { DECK, GUESS_MS, REVEAL_MS, higherLowerLogic as logic, judgeGuesses } from './logic';

describe('number questions', () => {
  it('has at least 150 questions, each with a numeric answer, a source and a unique id', () => {
    expect(NUMBER_QUESTIONS.length).toBeGreaterThanOrEqual(150);
    expect(new Set(NUMBER_QUESTIONS.map((q) => q.id)).size).toBe(NUMBER_QUESTIONS.length);
    for (const q of NUMBER_QUESTIONS) {
      expect(Number.isFinite(q.answer)).toBe(true);
      expect(q.source.length).toBeGreaterThan(0);
    }
  });

  it('skips rows whose answer is not a number', () => {
    const qs = parseNumberQuestions('question,answer,unit\nHow tall?,8849,m\nWho?,Bob,\nHow cold?,-89.2,°C\n');
    expect(qs.map((q) => q.answer)).toEqual([8849, -89.2]);
  });

  it('reads typed guesses with commas, spaces and minus signs', () => {
    expect(parseGuess('1,024')).toBe(1024);
    expect(parseGuess(' -89.2 ')).toBe(-89.2);
    expect(parseGuess('.5')).toBe(0.5);
    expect(parseGuess('')).toBeNull();
    expect(parseGuess('12abc')).toBeNull();
  });

  it('groups digits only when there is a unit, so years read normally', () => {
    expect(formatNumber(8849, 'm')).toBe('8,849');
    expect(formatNumber(1969)).toBe('1969');
  });
});

describe('judging', () => {
  it('closest wins, the same distance is a draw, no guess loses', () => {
    expect(judgeGuesses(100, 90, 120)).toBe('a');
    expect(judgeGuesses(100, 130, 95)).toBe('b');
    expect(judgeGuesses(100, 90, 110)).toBe('draw');
    expect(judgeGuesses(0.3, 0.1 + 0.2, 0.3)).toBe('draw');
    expect(judgeGuesses(100, null, 5000)).toBe('b');
    expect(judgeGuesses(100, null, null)).toBe('draw');
  });
});

describe('higher or lower game', () => {
  beforeEach(resetTriviaMemory);

  it('hides guesses and the answer until both lock in, then reveals and scores itself', () => {
    let s = logic.init(0, Math.random);
    s = logic.onInput(s, 'a', { action: 'guess', value: s.answer + 5 }, 1000, Math.random);
    expect(logic.project(s).locked).toEqual({ a: true, b: false });
    expect(logic.project(s).guesses).toBeNull();
    expect(logic.project(s).answer).toBeNull();
    // A second guess from the same phone is ignored.
    s = logic.onInput(s, 'a', { action: 'guess', value: s.answer }, 1500, Math.random);
    expect(s.guesses.a).toBe(s.answer + 5);
    s = logic.onInput(s, 'b', { action: 'guess', value: s.answer - 50 }, 2000, Math.random);
    expect(s.status).toBe('reveal');
    expect(logic.project(s).answer).toBe(s.answer);
    expect(logic.result(s)).toBeNull();
    s = logic.tick!(s, 2000 + REVEAL_MS, Math.random);
    expect(logic.result(s)).toBe('a');
  });

  it('the Host cannot guess', () => {
    const s = logic.init(0, Math.random);
    expect(logic.onInput(s, 'ref', { action: 'guess', value: 1 }, 0, Math.random)).toBe(s);
  });

  it('when time runs out, whoever guessed wins', () => {
    let s = logic.init(0, Math.random);
    s = logic.onInput(s, 'b', { action: 'guess', value: 1 }, 100, Math.random);
    s = logic.tick!(s, GUESS_MS, Math.random);
    s = logic.tick!(s, GUESS_MS + REVEAL_MS, Math.random);
    expect(logic.result(s)).toBe('b');
  });

  it('uses the host’s question memory', () => {
    const saved: string[][] = [];
    const had = NUMBER_QUESTIONS.slice(1).map((q) => q.id);
    connectTriviaMemory({ [DECK]: had }, (deck, ids) => deck === DECK && saved.push(ids));
    expect(logic.init(0, Math.random).questionId).toBe(NUMBER_QUESTIONS[0].id);
    expect(saved.at(-1)).toHaveLength(NUMBER_QUESTIONS.length);
  });
});
