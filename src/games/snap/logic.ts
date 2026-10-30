import type { MinigameLogic, Outcome } from '../types';

type Side = 'a' | 'b';

/**
 * Every card is a shape, a colour and a fill. A match needs all three to be the same, so the deck is
 * full of cards that are nearly right: same shape in a different colour, same colour on a different
 * shape, or the very same shape and colour but striped instead of solid.
 */
export const SHAPES = ['circle', 'square', 'triangle', 'star', 'heart', 'diamond'] as const;
export const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'] as const;
export const FILLS = ['solid', 'striped'] as const;
export type Shape = (typeof SHAPES)[number];
export type CardColor = (typeof COLORS)[number];
export type Fill = (typeof FILLS)[number];

export interface Card {
  shape: Shape;
  color: CardColor;
  fill: Fill;
}

export const TIME_MS = 60_000;
/** The dealer shuffles for a moment before the first pair goes down. */
export const SHUFFLE_MS = 2_000;
/** A new pair every 2 s at the start, speeding up to every 1.3 s by the end of the minute. */
export const DEAL_START_MS = 2_000;
export const DEAL_END_MS = 1_300;
/** After a good snap the table pauses so everyone can see who got it. */
export const SNAP_PAUSE_MS = 1_400;
/**
 * A snap is judged against the pair that phone was looking at. If it lands just after the next pair
 * went down (a slow connection), it still counts for the pair before, but only this soon after.
 */
export const GRACE_MS = 800;
/** Tied after the minute: sudden death. The next good snap wins, a wrong one loses. */
export const SNAPOFF_MS = 30_000;
export const REVEAL_MS = 5_000;

/** How often a deal is a match: about a quarter of the time, more in sudden death so it ends quickly. */
const MATCH_CHANCE = 0.27;
const SNAPOFF_MATCH_CHANCE = 0.4;
/** How often a non-match is a near miss rather than two cards with anything in common. */
const NEAR_MISS_CHANCE = 0.7;

export interface Deal {
  id: number;
  left: Card;
  right: Card;
  match: boolean;
  at: number;
  /** Who snapped this match first. A match can only be won once. */
  claimed: Side | null;
}

/** What a duelist's last snap did, so the screens can flash it. */
export interface SnapEvent {
  kind: 'snap' | 'wrong' | 'late';
  deal: number;
  at: number;
}

export interface SnapState {
  /** 'snapoff' is sudden death after a tie. */
  status: 'shuffling' | 'playing' | 'snapoff' | 'reveal' | 'done';
  scores: Record<Side, number>;
  deal: Deal | null;
  /** The pair before this one, for snaps that arrive a moment late. */
  prev: Deal | null;
  dealt: number;
  matches: number;
  startedAt: number;
  endsAt: number;
  nextDealAt: number;
  /** The last deal each duelist snapped on, so a double tap only counts once. */
  snapped: Record<Side, number>;
  last: Record<Side, SnapEvent | null>;
  /** How the duel was won, for the result line. */
  how: 'points' | 'snapoff' | 'snapoff-wrong' | null;
  revealUntil: number | null;
  winner: Outcome | null;
}

export interface SnapView {
  status: SnapState['status'];
  scores: Record<Side, number>;
  deal: { id: number; left: Card; right: Card; claimed: Side | null } | null;
  dealt: number;
  endsAt: number;
  last: Record<Side, SnapEvent | null>;
  how: SnapState['how'];
  winner: Outcome | null;
}

export const otherSide = (s: Side): Side => (s === 'a' ? 'b' : 'a');

const pick = <T>(list: readonly T[], rng: () => number) => list[Math.floor(rng() * list.length)];
const other = <T>(list: readonly T[], not: T, rng: () => number) => pick(list.filter((x) => x !== not), rng);

export const sameCard = (x: Card, y: Card) => x.shape === y.shape && x.color === y.color && x.fill === y.fill;

const randomCard = (rng: () => number): Card => ({ shape: pick(SHAPES, rng), color: pick(COLORS, rng), fill: pick(FILLS, rng) });

/** Two cards to put down: a match, a near miss (two of the three the same), or anything that isn't a match. */
export function dealPair(rng: () => number, matchChance = MATCH_CHANCE): { left: Card; right: Card; match: boolean } {
  const left = randomCard(rng);
  if (rng() < matchChance) return { left, right: { ...left }, match: true };
  let right: Card;
  if (rng() < NEAR_MISS_CHANCE) {
    const change = pick(['shape', 'color', 'fill'] as const, rng);
    right =
      change === 'shape'
        ? { ...left, shape: other(SHAPES, left.shape, rng) }
        : change === 'color'
          ? { ...left, color: other(COLORS, left.color, rng) }
          : { ...left, fill: other(FILLS, left.fill, rng) };
  } else {
    do right = randomCard(rng);
    while (sameCard(left, right));
  }
  // Either side can be the "original", so the striped one isn't always on the right.
  return rng() < 0.5 ? { left, right, match: false } : { left: right, right: left, match: false };
}

/** The gap before the next pair: 2 s at the start of the minute down to 1.3 s at the end. */
export function dealGap(s: Pick<SnapState, 'startedAt' | 'status'>, now: number) {
  if (s.status === 'snapoff') return DEAL_END_MS;
  const t = Math.min(1, Math.max(0, (now - s.startedAt) / TIME_MS));
  return Math.round(DEAL_START_MS + (DEAL_END_MS - DEAL_START_MS) * t);
}

function nextDeal(s: SnapState, now: number, rng: () => number): SnapState {
  const pair = dealPair(rng, s.status === 'snapoff' ? SNAPOFF_MATCH_CHANCE : MATCH_CHANCE);
  const deal: Deal = { id: s.dealt + 1, ...pair, at: now, claimed: null };
  return {
    ...s,
    prev: s.deal,
    deal,
    dealt: deal.id,
    matches: s.matches + (pair.match ? 1 : 0),
    nextDealAt: now + dealGap(s, now),
  };
}

function finish(s: SnapState, winner: Outcome, how: SnapState['how'], now: number): SnapState {
  return { ...s, status: 'reveal', winner, how, revealUntil: now + REVEAL_MS };
}

/** Which pair a snap is about: the one that phone saw, if it's still on the table or only just left it. */
function target(s: SnapState, dealId: unknown, now: number): Deal | null {
  const cur = s.deal;
  if (!cur) return null;
  const id = Number(dealId);
  if (!Number.isInteger(id) || id === cur.id) return cur;
  if (s.prev && id === s.prev.id && now - cur.at <= GRACE_MS) return s.prev;
  return null;
}

export const snapLogic: MinigameLogic<SnapState, SnapView> = {
  info: {
    id: 'snap',
    name: 'Snap!',
    rules: `The dealer puts down two cards at a time. When they match exactly (same shape, colour and pattern), hit SNAP on your phone for a point. Snap on a pair that doesn't match and you lose a point. Most points after a minute wins!`,
    refereeDuty: 'Nothing to judge: the game scores itself. Just watch for sneaky look-alikes!',
    icon: '🫰',
    color: '#d6336c',
    category: 'card',
    scoring: 'auto',
  },
  init(now) {
    return {
      status: 'shuffling',
      scores: { a: 0, b: 0 },
      deal: null,
      prev: null,
      dealt: 0,
      matches: 0,
      startedAt: now + SHUFFLE_MS,
      endsAt: now + SHUFFLE_MS + TIME_MS,
      nextDealAt: now + SHUFFLE_MS,
      snapped: { a: 0, b: 0 },
      last: { a: null, b: null },
      how: null,
      revealUntil: null,
      winner: null,
    };
  },
  onInput(s, role, payload, now) {
    if ((s.status !== 'playing' && s.status !== 'snapoff') || (role !== 'a' && role !== 'b') || payload?.action !== 'snap') return s;
    if (s.status === 'playing' && now >= s.endsAt) return s;
    const deal = target(s, payload.deal, now);
    if (!deal || s.snapped[role] >= deal.id) return s;
    const snapped = { ...s.snapped, [role]: deal.id };
    // Too slow: the other duelist already took this match. No point, but no penalty either.
    if (deal.match && deal.claimed) return { ...s, snapped, last: { ...s.last, [role]: { kind: 'late', deal: deal.id, at: now } } };
    // During the pause after a good snap nothing new is on the table, so only the claimed pair can be hit.
    if (deal.match) {
      const claimed = { ...deal, claimed: role };
      const next: SnapState = {
        ...s,
        snapped,
        deal: s.deal!.id === deal.id ? claimed : s.deal,
        prev: s.prev?.id === deal.id ? claimed : s.prev,
        scores: { ...s.scores, [role]: s.scores[role] + 1 },
        last: { ...s.last, [role]: { kind: 'snap', deal: deal.id, at: now } },
        nextDealAt: Math.max(s.nextDealAt, now + SNAP_PAUSE_MS),
      };
      return s.status === 'snapoff' ? finish(next, role, 'snapoff', now) : next;
    }
    const next: SnapState = {
      ...s,
      snapped,
      scores: { ...s.scores, [role]: s.scores[role] - 1 },
      last: { ...s.last, [role]: { kind: 'wrong', deal: deal.id, at: now } },
    };
    return s.status === 'snapoff' ? finish(next, otherSide(role), 'snapoff-wrong', now) : next;
  },
  tick(s, now, rng) {
    if (s.status === 'reveal') return s.revealUntil !== null && now >= s.revealUntil ? { ...s, status: 'done' } : s;
    if (s.status === 'done') return s;
    if (s.status !== 'snapoff' && now >= s.endsAt) {
      const { a, b } = s.scores;
      if (a !== b) return finish(s, a > b ? 'a' : 'b', 'points', now);
      // Tied: sudden death on a fresh pair.
      return nextDeal({ ...s, status: 'snapoff', deal: null, endsAt: now + SNAPOFF_MS }, now, rng);
    }
    // Nobody snapped a match in all of sudden death: call it a draw and the duel is replayed.
    if (s.status === 'snapoff' && now >= s.endsAt) return finish(s, 'draw', null, now);
    if (now >= s.nextDealAt) return nextDeal({ ...s, status: s.status === 'shuffling' ? 'playing' : s.status }, now, rng);
    return s;
  },
  result(s) {
    return s.status === 'done' ? s.winner : null;
  },
  project(s) {
    return {
      status: s.status,
      scores: s.scores,
      deal: s.deal && { id: s.deal.id, left: s.deal.left, right: s.deal.right, claimed: s.deal.claimed },
      dealt: s.dealt,
      endsAt: s.endsAt,
      last: s.last,
      how: s.how,
      winner: s.winner,
    };
  },
};
