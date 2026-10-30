import type { MinigameLogic, Outcome } from '../types';

/**
 * Every number that can come up. 1 to 100 covers everyday amounts (hours, ages, prices, people).
 * Above that the numbers are always round, and get rounder the bigger they are, so they stay guessable.
 */
export const NUMBERS: number[] = [
  ...Array.from({ length: 100 }, (_, i) => i + 1),
  ...steps(150, 1_000, 50),
  ...steps(1_500, 10_000, 500),
  ...steps(15_000, 100_000, 5_000),
  ...steps(150_000, 1_000_000, 50_000),
];
export const MIN = NUMBERS[0];
export const MAX = NUMBERS[NUMBERS.length - 1];
/** How long both numbers stay up on the big screen once someone guesses theirs. */
export const REVEAL_MS = 6_000;

type Side = 'a' | 'b';

export interface WhatsMyNumberState {
  /** asking: players take turns asking questions. reveal: someone guessed theirs, both numbers are shown. done: the result is in. */
  status: 'asking' | 'reveal' | 'done';
  numbers: Record<Side, number>;
  /** Who asks the first question (they take turns from there). */
  first: Side;
  winner: Outcome | null;
  revealUntil: number | null;
}

/** Everyone gets the same view; the duelists' phones and the big screen just don't show the numbers. */
export type WhatsMyNumberView = WhatsMyNumberState;

function steps(from: number, to: number, step: number) {
  return Array.from({ length: (to - from) / step + 1 }, (_, i) => from + i * step);
}

const roll = (rng: () => number) => NUMBERS[Math.floor(rng() * NUMBERS.length)];

/** How the numbers read on screen, e.g. 250,000. */
export const formatNumber = (n: number) => n.toLocaleString('en-US');

export const whatsMyNumberLogic: MinigameLogic<WhatsMyNumberState, WhatsMyNumberView> = {
  info: {
    id: 'whats-my-number',
    name: 'What’s my Number',
    shortName: 'My Number',
    rules: `You each get a secret number from 1 to a million (big ones are always round, like 250 or 5,000). Take turns asking the room yes or no questions, but they have to be subjective, like “If I slept this many hours, would that be normal?” First to guess their number wins!`,
    refereeDuty:
      'Help the audience answer yes or no, and block questions that just ask about the number (like “Is it over 50?”). Tap the player who says their exact number.',
    icon: '🔢',
    color: '#7fd6ff',
    category: 'misc',
    scoring: 'referee',
  },
  init(_now, rng) {
    const a = roll(rng);
    let b = roll(rng);
    while (b === a) b = roll(rng);
    return { status: 'asking', numbers: { a, b }, first: rng() < 0.5 ? 'a' : 'b', winner: null, revealUntil: null };
  },
  onInput(s, role, payload, now) {
    if (role !== 'ref') return s;
    const side: Side | null = payload?.side === 'a' || payload?.side === 'b' ? payload.side : null;
    if (s.status === 'asking' && payload?.action === 'guessed' && side) {
      return { ...s, status: 'reveal', winner: side, revealUntil: now + REVEAL_MS };
    }
    return s;
  },
  tick(s, now) {
    return s.status === 'reveal' && now >= s.revealUntil! ? { ...s, status: 'done' } : s;
  },
  result(s) {
    return s.status === 'done' ? s.winner : null;
  },
  project(s) {
    return s;
  },
};
