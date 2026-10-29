import type { MinigameLogic, Outcome } from '../types';
import { drawFrom } from '../trivia/deck';
import { NUMBER_QUESTIONS, parseGuess } from './bank';

export const GUESS_MS = 45_000;
export const REVEAL_MS = 7_000;
/** Name the used questions are remembered under in the host's account. */
export const DECK = 'higher-lower';

type Side = 'a' | 'b';

export interface HigherLowerState {
  /** guessing: phones are typing. reveal: guesses and answer on screen. done: result is in. */
  status: 'guessing' | 'reveal' | 'done';
  questionId: string;
  question: string;
  answer: number;
  unit: string;
  guesses: Record<Side, number | null>;
  guessEndsAt: number;
  revealUntil: number | null;
  winner: Outcome | null;
}

export interface HigherLowerView {
  status: HigherLowerState['status'];
  questionId: string;
  question: string;
  unit: string;
  guessEndsAt: number;
  locked: Record<Side, boolean>;
  /** Hidden until both have locked in (or time runs out). */
  answer: number | null;
  guesses: Record<Side, number | null> | null;
  winner: Outcome | null;
}

/** Closest guess wins. No guess loses to any guess; the same distance is a draw. */
export function judgeGuesses(answer: number, a: number | null, b: number | null): Outcome {
  if (a === null && b === null) return 'draw';
  if (a === null) return 'b';
  if (b === null) return 'a';
  // Round away floating point noise so 0.1 + 0.2 style differences can't break a tie.
  const da = Math.round(Math.abs(a - answer) * 1e6);
  const db = Math.round(Math.abs(b - answer) * 1e6);
  return da === db ? 'draw' : da < db ? 'a' : 'b';
}

function reveal(s: HigherLowerState, now: number): HigherLowerState {
  return {
    ...s,
    status: 'reveal',
    revealUntil: now + REVEAL_MS,
    winner: judgeGuesses(s.answer, s.guesses.a, s.guesses.b),
  };
}

export const higherLowerLogic: MinigameLogic<HigherLowerState, HigherLowerView> = {
  info: {
    id: 'higher-lower',
    name: 'Higher or Lower',
    shortName: 'High/Low',
    rules: 'A number question appears on the big screen. Type your guess on your phone. Closest to the real answer wins!',
    refereeDuty: 'The game scores itself. Your phone shows the answer: keep it secret until the reveal!',
    icon: '🔢',
    color: '#4fb3ff',
    category: 'misc',
    scoring: 'auto',
  },
  init(now, rng) {
    const q = drawFrom(DECK, NUMBER_QUESTIONS, rng);
    return {
      status: 'guessing',
      questionId: q.id,
      question: q.question,
      answer: q.answer,
      unit: q.unit,
      guesses: { a: null, b: null },
      guessEndsAt: now + GUESS_MS,
      revealUntil: null,
      winner: null,
    };
  },
  onInput(s, role, payload, now) {
    if (s.status !== 'guessing' || role === 'ref' || payload?.action !== 'guess') return s;
    // Locked in means locked in: the first guess counts.
    if (s.guesses[role] !== null) return s;
    const value = typeof payload.value === 'number' ? payload.value : parseGuess(String(payload.value ?? ''));
    if (value === null || !Number.isFinite(value)) return s;
    const next = { ...s, guesses: { ...s.guesses, [role]: value } };
    return next.guesses.a !== null && next.guesses.b !== null ? reveal(next, now) : next;
  },
  tick(s, now) {
    if (s.status === 'guessing' && now >= s.guessEndsAt) return reveal(s, now);
    if (s.status === 'reveal' && s.revealUntil !== null && now >= s.revealUntil) return { ...s, status: 'done' };
    return s;
  },
  result(s) {
    return s.status === 'done' ? s.winner : null;
  },
  project(s) {
    const shown = s.status !== 'guessing';
    return {
      status: s.status,
      questionId: s.questionId,
      question: s.question,
      unit: s.unit,
      guessEndsAt: s.guessEndsAt,
      locked: { a: s.guesses.a !== null, b: s.guesses.b !== null },
      answer: shown ? s.answer : null,
      guesses: shown ? s.guesses : null,
      winner: shown ? s.winner : null,
    };
  },
};
