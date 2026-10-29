import type { MinigameLogic, Outcome } from '../types';

export type Throw = 'rock' | 'paper' | 'scissors';
export const THROWS: Throw[] = ['rock', 'paper', 'scissors'];
export const THROW_MS = 10_000;
export const REVEAL_MS = 2_800;
export const WINS_NEEDED = 2;

export interface RpsThrowRecord {
  a: Throw;
  b: Throw;
  winner: Outcome;
  aAuto: boolean;
  bAuto: boolean;
}

export interface RpsState {
  scores: { a: number; b: number };
  picks: { a: Throw | null; b: Throw | null };
  throwEndsAt: number;
  /** Set while the last throw is being shown. */
  revealUntil: number | null;
  history: RpsThrowRecord[];
  done: boolean;
}

export interface RpsView {
  scores: { a: number; b: number };
  locked: { a: boolean; b: boolean };
  throwEndsAt: number;
  revealing: RpsThrowRecord | null;
  history: RpsThrowRecord[];
  throwNumber: number;
  done: boolean;
}

const beats: Record<Throw, Throw> = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

export function judgeThrow(a: Throw, b: Throw): Outcome {
  if (a === b) return 'draw';
  return beats[a] === b ? 'a' : 'b';
}

function resolve(s: RpsState, now: number, rng: () => number): RpsState {
  const aAuto = !s.picks.a;
  const bAuto = !s.picks.b;
  const a = s.picks.a ?? THROWS[Math.floor(rng() * 3)];
  const b = s.picks.b ?? THROWS[Math.floor(rng() * 3)];
  const winner = judgeThrow(a, b);
  const scores = { ...s.scores };
  if (winner !== 'draw') scores[winner] += 1;
  return {
    ...s,
    scores,
    picks: { a: null, b: null },
    history: [...s.history, { a, b, winner, aAuto, bAuto }],
    revealUntil: now + REVEAL_MS,
  };
}

export const rpsLogic: MinigameLogic<RpsState, RpsView> = {
  info: {
    id: 'rps',
    name: 'Rock Paper Scissors',
    shortName: 'R·P·S',
    rules: 'Best of 3. Pick in secret on your phone; ties are thrown again.',
    refereeDuty: 'The game scores itself. Tap Next round when it ends.',
    icon: '✂️',
    color: '#ff8a3d',
    needsReferee: false,
    scoring: 'auto',
  },
  init(now) {
    return {
      scores: { a: 0, b: 0 },
      picks: { a: null, b: null },
      throwEndsAt: now + THROW_MS,
      revealUntil: null,
      history: [],
      done: false,
    };
  },
  onInput(s, role, payload, now, rng) {
    if (s.done || s.revealUntil !== null || role === 'ref') return s;
    const pick = payload?.pick as Throw;
    if (!THROWS.includes(pick) || s.picks[role]) return s;
    const next = { ...s, picks: { ...s.picks, [role]: pick } };
    return next.picks.a && next.picks.b ? resolve(next, now, rng) : next;
  },
  tick(s, now, rng) {
    if (s.done) return s;
    if (s.revealUntil !== null) {
      if (now < s.revealUntil) return s;
      if (s.scores.a >= WINS_NEEDED || s.scores.b >= WINS_NEEDED) return { ...s, revealUntil: null, done: true };
      return { ...s, revealUntil: null, throwEndsAt: now + THROW_MS };
    }
    return now >= s.throwEndsAt ? resolve(s, now, rng) : s;
  },
  result(s) {
    if (!s.done) return null;
    return s.scores.a > s.scores.b ? 'a' : 'b';
  },
  project(s) {
    const last = s.history.at(-1) ?? null;
    return {
      scores: s.scores,
      locked: { a: !!s.picks.a, b: !!s.picks.b },
      throwEndsAt: s.throwEndsAt,
      revealing: s.revealUntil !== null ? last : null,
      history: s.history,
      throwNumber: s.history.length + (s.revealUntil !== null ? 0 : 1),
      done: s.done,
    };
  },
};
