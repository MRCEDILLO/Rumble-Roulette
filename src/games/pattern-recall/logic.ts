import type { MinigameLogic } from '../types';

type Side = 'a' | 'b';

/** The four pads. Each has its own shape too, so nobody has to tell colours apart by colour alone. */
export const PADS = [
  { id: 0, name: 'Red', color: '#e5383b', shape: 'circle' },
  { id: 1, name: 'Blue', color: '#3a86ff', shape: 'square' },
  { id: 2, name: 'Green', color: '#2bb24c', shape: 'triangle' },
  { id: 3, name: 'Yellow', color: '#ffc21a', shape: 'star' },
] as const;

/** The first pattern is this long, and every round both get right adds one more colour. */
export const START_LEN = 3;
/** If both get a pattern this long right, the quicker one wins, so a duel never runs forever. */
export const MAX_LEN = 12;

/** "Watch!" before the first flash. */
export const LEAD_MS = 1_500;
/** Time from one flash to the next. Gets quicker each round, down to the floor. */
export const stepMs = (len: number) => Math.max(450, 750 - (len - START_LEN) * 35);
/** How long a pad stays lit, out of its step. */
export const FLASH_SHARE = 0.65;
/** Time to repeat it: a little for every colour. */
export const inputMs = (len: number) => 5_000 + len * 1_000;
/** Pause on the result between rounds, and after the last one. */
export const ROUND_PAUSE_MS = 3_000;
export const REVEAL_MS = 6_000;

export type Progress = 'going' | 'done' | 'out';

/** How a round ended. 'both' = both got it, on to a longer one. 'replay' = same length again, new pattern. */
export type RoundEnd = { kind: 'win'; side: Side; why: 'only' | 'further' | 'quicker' } | { kind: 'both' } | { kind: 'replay' };

export interface PatternState {
  /** 'showing' covers the "Watch!" lead and the flashes. 'between' is the pause on each round's result. */
  status: 'showing' | 'input' | 'between' | 'done';
  round: number;
  pattern: number[];
  /** When the first pad lights up. */
  showAt: number;
  /** When the flashes end and presses start counting. */
  inputAt: number;
  endsAt: number;
  /** How many colours each duelist has got right so far. */
  correct: Record<Side, number>;
  progress: Record<Side, Progress>;
  /** The wrong pad each pressed, if they slipped. */
  slip: Record<Side, number | null>;
  /** How long each took to get the whole pattern, from when they could start pressing. */
  took: Record<Side, number | null>;
  /** Ran out of time rather than pressing a wrong one. */
  timedOut: Record<Side, boolean>;
  roundEnd: RoundEnd | null;
  nextAt: number | null;
  winner: Side | null;
}

export interface PatternView extends Omit<PatternState, 'pattern'> {
  /** The pattern, while it is being shown and after the round. null while the duelists repeat it. */
  pattern: number[] | null;
  /** How long the pattern is, always known. */
  length: number;
}

export const otherSide = (s: Side): Side => (s === 'a' ? 'b' : 'a');

/** A random pattern. The same pad never comes up three times in a row, which reads as a stuck screen. */
export function makePattern(len: number, rng: () => number): number[] {
  const out: number[] = [];
  while (out.length < len) {
    const pad = Math.floor(rng() * PADS.length);
    const n = out.length;
    if (n >= 2 && out[n - 1] === pad && out[n - 2] === pad) continue;
    out.push(pad);
  }
  return out;
}

/** A new pattern to watch, `len` colours long. */
function newRound(len: number, now: number, rng: () => number) {
  const showAt = now + LEAD_MS;
  const inputAt = showAt + len * stepMs(len);
  return {
    status: 'showing' as const,
    pattern: makePattern(len, rng),
    showAt,
    inputAt,
    endsAt: inputAt + inputMs(len),
    correct: { a: 0, b: 0 },
    progress: { a: 'going', b: 'going' } as Record<Side, Progress>,
    slip: { a: null, b: null },
    took: { a: null, b: null },
    timedOut: { a: false, b: false },
    roundEnd: null,
    nextAt: null,
  };
}

/** Both are finished (got it or slipped): work out who, if anyone, won the round. */
export function judge(s: Pick<PatternState, 'progress' | 'correct' | 'took' | 'pattern'>): RoundEnd {
  const { a, b } = s.progress;
  if (a === 'done' && b === 'done') {
    if (s.pattern.length < MAX_LEN) return { kind: 'both' };
    // Both got the longest pattern: quicker wins. A dead heat plays it again.
    if (s.took.a! === s.took.b!) return { kind: 'replay' };
    return { kind: 'win', side: s.took.a! < s.took.b! ? 'a' : 'b', why: 'quicker' };
  }
  if (a === 'done') return { kind: 'win', side: 'a', why: 'only' };
  if (b === 'done') return { kind: 'win', side: 'b', why: 'only' };
  // Both slipped: whoever got further along wins. Same spot plays it again.
  if (s.correct.a === s.correct.b) return { kind: 'replay' };
  return { kind: 'win', side: s.correct.a > s.correct.b ? 'a' : 'b', why: 'further' };
}

function endRound(s: PatternState, now: number): PatternState {
  const roundEnd = judge(s);
  const winner = roundEnd.kind === 'win' ? roundEnd.side : null;
  return { ...s, status: 'between', roundEnd, winner, nextAt: now + (winner ? REVEAL_MS : ROUND_PAUSE_MS) };
}

export const patternRecallLogic: MinigameLogic<PatternState, PatternView> = {
  info: {
    id: 'pattern-recall',
    name: 'Pattern Recall',
    rules: `Watch the colours flash, then tap the same pattern on your phone. It starts ${START_LEN} long and gets one longer each round. Tap a wrong colour or run out of time and you're out. Both slip? Whoever got further wins.`,
    refereeDuty: 'Nothing to judge: the game scores itself. Keep the crowd from calling out the colours!',
    icon: '🚦',
    color: '#7b4dd8',
    category: 'puzzle',
    scoring: 'auto',
  },
  init(now, rng) {
    return { ...newRound(START_LEN, now, rng), round: 1, winner: null };
  },
  onInput(s, role, payload, now) {
    if (s.status !== 'input' || (role !== 'a' && role !== 'b') || payload?.action !== 'press') return s;
    if (now < s.inputAt || s.progress[role] !== 'going') return s;
    const pad = Number(payload.pad);
    if (!Number.isInteger(pad) || pad < 0 || pad >= PADS.length) return s;
    let next: PatternState;
    if (pad === s.pattern[s.correct[role]]) {
      const correct = s.correct[role] + 1;
      const done = correct === s.pattern.length;
      next = {
        ...s,
        correct: { ...s.correct, [role]: correct },
        progress: done ? { ...s.progress, [role]: 'done' } : s.progress,
        took: done ? { ...s.took, [role]: now - s.inputAt } : s.took,
      };
    } else {
      next = { ...s, progress: { ...s.progress, [role]: 'out' }, slip: { ...s.slip, [role]: pad } };
    }
    return next.progress.a !== 'going' && next.progress.b !== 'going' ? endRound(next, now) : next;
  },
  tick(s, now, rng) {
    if (s.status === 'showing' && now >= s.inputAt) return { ...s, status: 'input' };
    if (s.status === 'input' && now >= s.endsAt) {
      // Anyone still pressing is out of time.
      const late = (side: Side) => s.progress[side] === 'going';
      const next: PatternState = {
        ...s,
        progress: { a: late('a') ? 'out' : s.progress.a, b: late('b') ? 'out' : s.progress.b },
        timedOut: { a: late('a'), b: late('b') },
      };
      return endRound(next, now);
    }
    if (s.status === 'between' && s.nextAt !== null && now >= s.nextAt) {
      if (s.winner) return { ...s, status: 'done' };
      const len = s.roundEnd?.kind === 'both' ? s.pattern.length + 1 : s.pattern.length;
      return { ...s, ...newRound(len, now, rng), round: s.round + 1 };
    }
    return s;
  },
  result(s) {
    return s.status === 'done' ? s.winner : null;
  },
  project(s) {
    return { ...s, pattern: s.status === 'input' ? null : s.pattern, length: s.pattern.length };
  },
};
