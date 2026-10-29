import { beforeEach, describe, expect, it } from 'vitest';
import { parseCsv } from './csv';
import { TRIVIA_CATEGORIES, parseQuestions } from './bank';
import { connectTriviaMemory, drawQuestion, questionsLeft, resetTriviaMemory } from './deck';
import { makeTriviaLogic } from './logic';

const science = TRIVIA_CATEGORIES.find((c) => c.id === 'science')!;
const logic = makeTriviaLogic(science);

describe('question files', () => {
  it('reads quoted fields with commas and quotes', () => {
    expect(parseCsv('question,answer\r\n"A, B?","say ""hi"""\n')).toEqual([
      ['question', 'answer'],
      ['A, B?', 'say "hi"'],
    ]);
  });

  it('skips blank and repeated questions', () => {
    const qs = parseQuestions('Question,Answer\nWhat?,This\n\n what? ,That\nWho?,\n');
    expect(qs.map((q) => q.answer)).toEqual(['This']);
  });

  it('has at least 300 science questions, each with an answer and a unique id', () => {
    expect(science.questions.length).toBeGreaterThanOrEqual(300);
    expect(new Set(science.questions.map((q) => q.id)).size).toBe(science.questions.length);
    for (const q of science.questions) expect(q.answer.length).toBeGreaterThan(0);
  });
});

describe('question deck', () => {
  beforeEach(resetTriviaMemory);

  it('never repeats a question until the category is used up, then starts over', () => {
    const total = science.questions.length;
    const seen = new Set<string>();
    for (let i = 0; i < total; i++) seen.add(drawQuestion('science', Math.random).id);
    expect(seen.size).toBe(total);
    expect(questionsLeft('science')).toBe(0);
    drawQuestion('science', Math.random);
    expect(questionsLeft('science')).toBe(total - 1);
  });

  it('skips questions the host already had and saves each draw', () => {
    const saved: string[][] = [];
    const had = science.questions.slice(1).map((q) => q.id);
    connectTriviaMemory({ science: had }, (_cat, ids) => saved.push(ids));
    expect(drawQuestion('science', Math.random).id).toBe(science.questions[0].id);
    expect(saved.at(-1)).toHaveLength(science.questions.length);
  });
});

describe('trivia game', () => {
  beforeEach(resetTriviaMemory);
  const start = () => logic.init(0, Math.random);

  it('hides the answer until the Host reveals it', () => {
    let s = start();
    expect(logic.project(s).answer).toBeNull();
    s = logic.onInput(s, 'a', { action: 'buzz' }, 0, Math.random);
    expect(logic.project(s).answer).toBeNull();
    s = logic.onInput(s, 'ref', { action: 'reveal' }, 0, Math.random);
    expect(logic.project(s).answer).toBe(s.answer);
  });

  it('gives the round to the first buzzer when they are right', () => {
    let s = start();
    s = logic.onInput(s, 'b', { action: 'buzz' }, 0, Math.random);
    s = logic.onInput(s, 'a', { action: 'buzz' }, 0, Math.random);
    expect(s.buzzer).toBe('b');
    s = logic.onInput(s, 'ref', { action: 'reveal' }, 0, Math.random);
    s = logic.onInput(s, 'ref', { action: 'judge', correct: true }, 0, Math.random);
    expect(logic.result(s)).toBe('b');
  });

  it('gives the round to the other player when the buzzer is wrong', () => {
    let s = start();
    s = logic.onInput(s, 'a', { action: 'buzz' }, 0, Math.random);
    s = logic.onInput(s, 'ref', { action: 'reveal' }, 0, Math.random);
    s = logic.onInput(s, 'ref', { action: 'judge', correct: false }, 0, Math.random);
    expect(logic.result(s)).toBe('b');
  });

  it('only lets the Host judge, and only after a buzz', () => {
    let s = start();
    expect(logic.onInput(s, 'ref', { action: 'judge', correct: true }, 0, Math.random)).toBe(s);
    s = logic.onInput(s, 'a', { action: 'buzz' }, 0, Math.random);
    expect(logic.onInput(s, 'a', { action: 'judge', correct: true }, 0, Math.random)).toBe(s);
  });

  it('moves on to a new question when nobody knows it', () => {
    let s = start();
    const first = s.questionId;
    s = logic.onInput(s, 'ref', { action: 'nobody' }, 0, Math.random);
    expect(logic.project(s).answer).not.toBeNull();
    s = logic.onInput(s, 'ref', { action: 'next' }, 0, Math.random);
    expect(s.status).toBe('open');
    expect(s.number).toBe(2);
    expect(s.questionId).not.toBe(first);
  });
});
