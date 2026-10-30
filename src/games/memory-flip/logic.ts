import type { MinigameLogic, Outcome } from '../types';

type Side = 'a' | 'b';

/**
 * 4×4 with 8 pairs. A 5×5 board (12 pairs) roughly doubles the game to 3+ minutes, and its cards get
 * too small to read on a phone; 16 cards keeps a round around a minute and every card big and clear.
 */
export const COLS = 4;
export const PAIRS = 8;
export const SHAPES = ['circle', 'square', 'triangle', 'star', 'heart', 'diamond', 'hexagon', 'cross'] as const;
export type Shape = (typeof SHAPES)[number];

export const TURN_MS = 12_000;
/** How long two flipped cards stay up before they flip back (or get claimed). */
export const SHOW_MS = 1_800;
export const MATCH_SHOW_MS = 1_000;
export const REVEAL_MS = 5_000;

export interface MemoryFlipState {
  status: 'playing' | 'showing' | 'reveal' | 'done';
  /** The shape under each card, row by row. Never sent to phones as-is. */
  cards: Shape[];
  /** Who found each card's pair, or null while it's still in play. */
  taken: (Side | null)[];
  /** The cards flipped up this turn (0 to 2). */
  flipped: number[];
  turn: Side;
  /** Who went first, picked at random so neither seat always gets it. */
  first: Side;
  turnEndsAt: number;
  showUntil: number | null;
  /** How the last pair of flips went, so screens can say so. */
  last: { match: boolean; auto: boolean } | null;
  revealUntil: number | null;
  winner: Outcome | null;
}

export interface MemoryFlipView {
  status: MemoryFlipState['status'];
  /** Only face-up cards show their shape. */
  cards: { shape: Shape | null; taken: Side | null; up: boolean }[];
  pairs: Record<Side, number>;
  turn: Side;
  first: Side;
  turnEndsAt: number;
  last: MemoryFlipState['last'];
  winner: Outcome | null;
}

export const otherSide = (s: Side): Side => (s === 'a' ? 'b' : 'a');

export function pairsOf(s: Pick<MemoryFlipState, 'taken'>, side: Side) {
  return s.taken.filter((t) => t === side).length / 2;
}

function shuffle<T>(list: T[], rng: () => number) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const faceDown = (s: MemoryFlipState) => s.cards.map((_, i) => i).filter((i) => s.taken[i] === null && !s.flipped.includes(i));

function flip(s: MemoryFlipState, card: number, now: number, auto: boolean): MemoryFlipState {
  const flipped = [...s.flipped, card];
  if (flipped.length < 2) return { ...s, flipped };
  const [x, y] = flipped;
  const match = s.cards[x] === s.cards[y];
  const taken = match ? s.taken.map((t, i) => (i === x || i === y ? s.turn : t)) : s.taken;
  return {
    ...s,
    flipped,
    taken,
    status: 'showing',
    showUntil: now + (match ? MATCH_SHOW_MS : SHOW_MS),
    last: { match, auto },
  };
}

/** After the two cards have been seen: a match goes again, a miss passes the turn, the last pair ends it. */
function settleTurn(s: MemoryFlipState, now: number): MemoryFlipState {
  const next = { ...s, flipped: [], showUntil: null };
  if (s.taken.every((t) => t !== null)) {
    const a = pairsOf(s, 'a');
    const b = pairsOf(s, 'b');
    // Same number of pairs is a draw, which the duel replays like any other draw.
    const winner: Outcome = a > b ? 'a' : b > a ? 'b' : 'draw';
    return { ...next, status: 'reveal', winner, revealUntil: now + REVEAL_MS };
  }
  const turn = s.last?.match ? s.turn : otherSide(s.turn);
  return { ...next, status: 'playing', turn, turnEndsAt: now + TURN_MS };
}

export const memoryFlipLogic: MinigameLogic<MemoryFlipState, MemoryFlipView> = {
  info: {
    id: 'memory-flip',
    name: 'Memory Flip',
    rules: `Take turns flipping two cards on the ${COLS}×${COLS} grid. Find a matching pair to keep it and go again; miss and they flip back, so remember where they were! A random player goes first. Most pairs wins.`,
    refereeDuty: 'Nothing to judge: the game scores itself. Just watch the cards!',
    icon: '🃏',
    color: '#9b5de5',
    category: 'puzzle',
    scoring: 'auto',
  },
  init(now, rng) {
    const first: Side = rng() < 0.5 ? 'a' : 'b';
    const deck = SHAPES.slice(0, PAIRS).flatMap((shape) => [shape, shape]);
    return {
      status: 'playing',
      cards: shuffle(deck, rng),
      taken: deck.map(() => null),
      flipped: [],
      turn: first,
      first,
      turnEndsAt: now + TURN_MS,
      showUntil: null,
      last: null,
      revealUntil: null,
      winner: null,
    };
  },
  onInput(s, role, payload, now) {
    if (s.status !== 'playing' || role !== s.turn || payload?.action !== 'flip') return s;
    const card = Number(payload.card);
    if (!faceDown(s).includes(card)) return s;
    return flip(s, card, now, false);
  },
  tick(s, now, rng) {
    if (s.status === 'playing' && now >= s.turnEndsAt) {
      // Out of time: the rest of their two cards flip at random, so the game never stalls.
      let t = s;
      while (t.status === 'playing') {
        const open = faceDown(t);
        t = flip(t, open[Math.floor(rng() * open.length)], now, true);
      }
      return t;
    }
    if (s.status === 'showing' && s.showUntil !== null && now >= s.showUntil) return settleTurn(s, now);
    if (s.status === 'reveal' && s.revealUntil !== null && now >= s.revealUntil) return { ...s, status: 'done' };
    return s;
  },
  result(s) {
    return s.status === 'done' ? s.winner : null;
  },
  project(s) {
    const over = s.status === 'reveal' || s.status === 'done';
    return {
      status: s.status,
      cards: s.cards.map((shape, i) => {
        const up = s.taken[i] !== null || s.flipped.includes(i) || over;
        return { shape: up ? shape : null, taken: s.taken[i], up };
      }),
      pairs: { a: pairsOf(s, 'a'), b: pairsOf(s, 'b') },
      turn: s.turn,
      first: s.first,
      turnEndsAt: s.turnEndsAt,
      last: s.last,
      winner: over ? s.winner : null,
    };
  },
};
