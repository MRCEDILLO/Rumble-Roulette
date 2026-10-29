import type { MinigameLogic, Outcome } from '../types';
import type { TriviaCategory } from './bank';
import { drawQuestion } from './deck';

export interface TriviaState {
  /**
   * open: question is up, buzzers are live. buzzed: someone buzzed and is answering.
   * revealed: the Host showed the answer and is marking it. nobody: nobody knew, answer shown.
   */
  status: 'open' | 'buzzed' | 'revealed' | 'nobody' | 'done';
  questionId: string;
  question: string;
  answer: string;
  /** Which question of this duel this is (goes up when nobody knew one). */
  number: number;
  buzzer: 'a' | 'b' | null;
  correct: boolean | null;
  winner: Outcome | null;
}

export interface TriviaView {
  category: string;
  status: TriviaState['status'];
  questionId: string;
  question: string;
  /** Hidden until the Host reveals it (the Host's phone looks it up itself). */
  answer: string | null;
  number: number;
  buzzer: 'a' | 'b' | null;
  correct: boolean | null;
  winner: Outcome | null;
}

export const triviaGameId = (category: string) => `trivia-${category}`;

/** Builds the game for one trivia category. Every category plays the same way. */
export function makeTriviaLogic(cat: TriviaCategory): MinigameLogic<TriviaState, TriviaView> {
  const ask = (rng: () => number, number: number, avoid?: string): TriviaState => {
    const q = drawQuestion(cat.id, rng, avoid);
    return {
      status: 'open',
      questionId: q.id,
      question: q.question,
      answer: q.answer,
      number,
      buzzer: null,
      correct: null,
      winner: null,
    };
  };

  return {
    info: {
      id: triviaGameId(cat.id),
      name: `${cat.name} Trivia`,
      shortName: cat.name,
      rules: 'Read the question on the big screen. First to buzz answers out loud. Right: you win. Wrong: the other player wins.',
      refereeDuty:
        'Your phone shows the answer: keep it secret! When someone buzzes, listen to their answer, reveal it, then mark it right or wrong.',
      icon: cat.icon,
      color: cat.color,
      category: 'trivia',
      scoring: 'referee',
    },
    init(_now, rng) {
      return ask(rng, 1);
    },
    onInput(s, role, payload, _now, rng) {
      const action = payload?.action;
      if ((role === 'a' || role === 'b') && action === 'buzz' && s.status === 'open') {
        // First buzz to reach the host wins.
        return { ...s, status: 'buzzed', buzzer: role };
      }
      if (role !== 'ref') return s;
      if (action === 'reveal' && s.status === 'buzzed') return { ...s, status: 'revealed' };
      if (action === 'judge' && (s.status === 'buzzed' || s.status === 'revealed') && typeof payload.correct === 'boolean') {
        const other = s.buzzer === 'a' ? 'b' : 'a';
        return { ...s, status: 'done', correct: payload.correct, winner: payload.correct ? s.buzzer : other };
      }
      if (action === 'nobody' && s.status === 'open') return { ...s, status: 'nobody' };
      if (action === 'next' && s.status === 'nobody') return ask(rng, s.number + 1, s.questionId);
      return s;
    },
    result(s) {
      return s.status === 'done' ? s.winner : null;
    },
    project(s) {
      const shown = s.status === 'revealed' || s.status === 'nobody' || s.status === 'done';
      return {
        category: cat.id,
        status: s.status,
        questionId: s.questionId,
        question: s.question,
        answer: shown ? s.answer : null,
        number: s.number,
        buzzer: s.buzzer,
        correct: s.correct,
        winner: s.winner,
      };
    },
  };
}
