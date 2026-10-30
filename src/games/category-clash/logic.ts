import type { MinigameLogic, Outcome } from '../types';
import { questionId } from '../trivia/bank';
import { drawFrom } from '../trivia/deck';
import file from './categories.txt?raw';

/** Name the used categories are remembered under in the host's account. */
export const DECK = 'category-clash';
/** Each duelist's clock, like a chess clock: it only runs on their turn. */
export const CLOCK_MS = 30_000;
/** Time to read the category before the first clock starts. */
export const READ_MS = 5_000;
/** How long the result stays on the big screen before the duel ends. */
export const RESULT_MS = 4_000;

export type Side = 'a' | 'b';
export const other = (s: Side): Side => (s === 'a' ? 'b' : 'a');

export interface Category {
  id: string;
  text: string;
}

/** Reads the category file: one category per line, `#` lines are notes. Repeats are skipped. */
export function parseCategories(text: string): Category[] {
  const seen = new Set<string>();
  const out: Category[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const id = questionId(t);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, text: t });
  }
  return out;
}

export const CATEGORIES = parseCategories(file);

export interface ClashState {
  /**
   * reading: the category is up, no clock runs yet (the Host can draw a new one).
   * running: whoever's turn it is has their clock running down.
   * paused: the Host stopped the clock to check an answer.
   * result: someone's clock hit zero.
   */
  status: 'reading' | 'running' | 'paused' | 'result' | 'done';
  category: Category;
  /** Which category of this duel this is (goes up when the Host draws a new one). */
  number: number;
  turn: Side;
  /** Time left on each clock, as of `since` for the one that's running. */
  left: Record<Side, number>;
  /** When the running clock last started (host clock). Null when no clock is running. */
  since: number | null;
  readUntil: number;
  /** Who passed the turn last, so the Host can send it back to them if their answer didn't count. */
  lastPass: Side | null;
  /** How many answers have been passed over so far. */
  answers: number;
  resultUntil: number | null;
  winner: Outcome | null;
}

/** Everyone sees the same thing: there's nothing secret in this game. */
export type ClashView = Omit<ClashState, 'resultUntil'>;

/** What a clock shows right now. */
export function timeLeft(v: Pick<ClashState, 'status' | 'turn' | 'left' | 'since'>, side: Side, now: number) {
  const running = v.status === 'running' && v.turn === side && v.since !== null;
  return Math.max(0, v.left[side] - (running ? now - v.since! : 0));
}

/** Stops the running clock, taking off the time it ran. */
function stopClock(s: ClashState, now: number): ClashState {
  if (s.since === null) return s;
  return { ...s, left: { ...s.left, [s.turn]: timeLeft(s, s.turn, now) }, since: null };
}

function newCategory(s: ClashState | null, now: number, rng: () => number): ClashState {
  return {
    status: 'reading',
    category: drawFrom(DECK, CATEGORIES, rng, s?.category.id),
    number: (s?.number ?? 0) + 1,
    // Who goes first is random, and stays the same if the Host swaps the category.
    turn: s?.turn ?? (rng() < 0.5 ? 'a' : 'b'),
    left: { a: CLOCK_MS, b: CLOCK_MS },
    since: null,
    readUntil: now + READ_MS,
    lastPass: null,
    answers: 0,
    resultUntil: null,
    winner: null,
  };
}

export const categoryClashLogic: MinigameLogic<ClashState, ClashView> = {
  info: {
    id: 'category-clash',
    name: 'Category Clash',
    rules:
      'Take turns naming things in the category. Say one, then hit your buzzer to pass. Your 30-second clock only runs on your turn. Run out first and you lose!',
    refereeDuty:
      'Listen to every answer. Pause the clocks if one sounds wrong or repeated, then play on or send the turn back. You can swap the category before the clocks start.',
    icon: '⏱️',
    color: '#4cc9f0',
    category: 'word',
    scoring: 'referee',
  },
  init(now, rng) {
    return newCategory(null, now, rng);
  },
  onInput(s, role, payload, now, rng) {
    const action = payload?.action;

    // Say an answer, then pass: your clock stops and theirs starts.
    if (role === s.turn && action === 'pass' && s.status === 'running') {
      const stopped = stopClock(s, now);
      return { ...stopped, turn: other(s.turn), since: now, lastPass: s.turn, answers: s.answers + 1 };
    }

    if (role !== 'ref') return s;
    if (action === 'redraw' && s.status === 'reading') return newCategory(s, now, rng);
    if (action === 'start' && s.status === 'reading') return { ...s, status: 'running', since: now };
    if (action === 'pause' && s.status === 'running') return { ...stopClock(s, now), status: 'paused' };
    // The answer was fine: the same clock carries on.
    if (action === 'play' && s.status === 'paused') return { ...s, status: 'running', since: now };
    // The answer didn't count: the player who passed has to name another one, on their own clock.
    if (action === 'sendBack' && s.status === 'paused' && s.lastPass !== null) {
      return { ...s, status: 'running', turn: s.lastPass, lastPass: null, answers: s.answers - 1, since: now };
    }
    return s;
  },
  tick(s, now) {
    if (s.status === 'reading' && now >= s.readUntil) return { ...s, status: 'running', since: s.readUntil };
    if (s.status === 'running' && timeLeft(s, s.turn, now) <= 0) {
      return {
        ...s,
        status: 'result',
        left: { ...s.left, [s.turn]: 0 },
        since: null,
        winner: other(s.turn),
        resultUntil: now + RESULT_MS,
      };
    }
    if (s.status === 'result' && s.resultUntil !== null && now >= s.resultUntil) return { ...s, status: 'done' };
    return s;
  },
  result(s) {
    return s.status === 'done' ? s.winner : null;
  },
  project(s) {
    const { resultUntil: _, ...view } = s;
    return view;
  },
};
