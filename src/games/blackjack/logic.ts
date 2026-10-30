import type { MinigameLogic, Outcome } from '../types';

type Side = 'a' | 'b';

/** A plain 52-card deck: four suits, Ace to King. */
export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export type Suit = (typeof SUITS)[number];
export type Rank = (typeof RANKS)[number];

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type Choice = 'hit' | 'stand';

/** The dealer hands out two cards each before the first choice. */
export const DEAL_MS = 2_400;
/** Time to pick Hit or Stand. Nothing picked in time counts as Stand. */
export const CHOOSE_MS = 15_000;
/** Both choices stay up on the big screen for a moment before any new cards go down. */
export const SHOW_MS = 1_800;
/** A tie or a double bust: everyone sees the hands, then a fresh hand is dealt. */
export const PUSH_MS = 4_000;
export const REVEAL_MS = 5_000;

export interface Hand {
  cards: Card[];
  /** Stood (by choice or by running out of time): no more cards. */
  stood: boolean;
}

export interface BlackjackState {
  /**
   * dealing → choosing → showing → choosing … until both are done, then 'push' (deal again) or 'reveal'.
   */
  status: 'dealing' | 'choosing' | 'showing' | 'push' | 'reveal' | 'done';
  /** 1 for the first hand, 2 after a push, and so on. */
  hand: number;
  /** Which turn of the hand this is, so the phones know when a new choice is due. */
  turn: number;
  hands: Record<Side, Hand>;
  /** Cards still to deal, top of the deck last. Never sent to the screens. */
  deck: Card[];
  /** This turn's secret picks. Only shown once everyone still playing has picked. */
  choices: Record<Side, Choice | null>;
  /** Picks the clock made for someone who didn't choose in time. */
  timedOut: Record<Side, boolean>;
  until: number;
  revealUntil: number | null;
  winner: Outcome | null;
}

export interface BlackjackView {
  status: BlackjackState['status'];
  hand: number;
  turn: number;
  hands: Record<Side, Hand>;
  /** During choosing: who has locked in, without saying what. */
  locked: Record<Side, boolean>;
  /** Only once both picks are in (status 'showing'). */
  shown: Record<Side, Choice | null>;
  timedOut: Record<Side, boolean>;
  until: number;
  winner: Outcome | null;
}

export const otherSide = (s: Side): Side => (s === 'a' ? 'b' : 'a');

/** Number cards count their number, J/Q/K count 10, and an Ace is 1 or 11, whichever is better. */
export function cardValue(c: Card) {
  if (c.rank === 'A') return 1;
  if (c.rank === 'J' || c.rank === 'Q' || c.rank === 'K') return 10;
  return Number(c.rank);
}

/** The best total for a hand, and whether an Ace is being counted as 11 ("soft"). */
export function handTotal(cards: Card[]) {
  const hard = cards.reduce((t, c) => t + cardValue(c), 0);
  const soft = cards.some((c) => c.rank === 'A') && hard + 10 <= 21;
  return { total: soft ? hard + 10 : hard, soft };
}

export const isBust = (h: Hand) => handTotal(h.cards).total > 21;
/**
 * Still choosing: not stood and not bust. Even on 21 you still pick (Stand, surely), because stopping
 * on your own would tell the other duelist you've got 21.
 */
export const isActive = (h: Hand) => !h.stood && !isBust(h);

export function freshDeck(rng: () => number): Card[] {
  const deck = SUITS.flatMap((suit) => RANKS.map((rank) => ({ rank, suit })));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

const noChoices = (): Record<Side, Choice | null> => ({ a: null, b: null });

/** A new shuffled deck and two cards each, dealt a, b, a, b. */
function deal(hand: number, now: number, rng: () => number): BlackjackState {
  const deck = freshDeck(rng);
  const a = [deck.pop()!];
  const b = [deck.pop()!];
  a.push(deck.pop()!);
  b.push(deck.pop()!);
  return {
    status: 'dealing',
    hand,
    turn: 0,
    hands: { a: { cards: a, stood: false }, b: { cards: b, stood: false } },
    deck,
    choices: noChoices(),
    timedOut: { a: false, b: false },
    until: now + DEAL_MS,
    revealUntil: null,
    winner: null,
  };
}

/** Who won once both are done, or 'draw' for a tie or a double bust (which means a new hand). */
export function judge(hands: Record<Side, Hand>): Outcome {
  const bust = { a: isBust(hands.a), b: isBust(hands.b) };
  if (bust.a && bust.b) return 'draw';
  if (bust.a) return 'b';
  if (bust.b) return 'a';
  const a = handTotal(hands.a.cards).total;
  const b = handTotal(hands.b.cards).total;
  return a === b ? 'draw' : a > b ? 'a' : 'b';
}

/** After a deal or a turn: keep choosing, or settle the hand. A bust ends it straight away. */
function settle(s: BlackjackState, now: number): BlackjackState {
  const anyBust = isBust(s.hands.a) || isBust(s.hands.b);
  if (!anyBust && (isActive(s.hands.a) || isActive(s.hands.b))) {
    return { ...s, status: 'choosing', turn: s.turn + 1, choices: noChoices(), timedOut: { a: false, b: false }, until: now + CHOOSE_MS };
  }
  const winner = judge(s.hands);
  if (winner === 'draw') return { ...s, status: 'push', winner: null, until: now + PUSH_MS };
  return { ...s, status: 'reveal', winner, revealUntil: now + REVEAL_MS };
}

/** Everyone still playing has picked: show the picks together. */
function allIn(s: BlackjackState) {
  return (['a', 'b'] as Side[]).every((side) => !isActive(s.hands[side]) || s.choices[side] !== null);
}

/** Stand means done for the hand; Hit takes the top card. Both happen at once. */
function playTurn(s: BlackjackState, now: number): BlackjackState {
  const deck = [...s.deck];
  const hands = { ...s.hands };
  for (const side of ['a', 'b'] as Side[]) {
    const c = s.choices[side];
    if (c === 'stand') hands[side] = { ...hands[side], stood: true };
    if (c === 'hit') hands[side] = { ...hands[side], cards: [...hands[side].cards, deck.pop()!] };
  }
  return settle({ ...s, deck, hands }, now);
}

export const blackjackLogic: MinigameLogic<BlackjackState, BlackjackView> = {
  info: {
    id: 'blackjack',
    name: 'Blackjack',
    rules: `You both get two cards that only you can see, on your phone. Each turn, secretly pick HIT (take another card) or STAND (stop). The picks are shown once you've both chosen, and the cards are turned over at the end. Closest to 21 without going over wins!`,
    refereeDuty: 'Nothing to judge: the game scores itself. Enjoy the poker faces!',
    icon: '🂡',
    color: '#1f8f4e',
    category: 'card',
    scoring: 'auto',
  },
  init(now, rng) {
    return deal(1, now, rng);
  },
  onInput(s, role, payload, now) {
    if (s.status !== 'choosing' || (role !== 'a' && role !== 'b')) return s;
    const choice = payload?.choice;
    if (choice !== 'hit' && choice !== 'stand') return s;
    // One pick per turn, no changing your mind, and only while you're still in the hand.
    if (s.choices[role] || !isActive(s.hands[role]) || Number(payload?.turn ?? s.turn) !== s.turn) return s;
    const next = { ...s, choices: { ...s.choices, [role]: choice } };
    return allIn(next) ? { ...next, status: 'showing', until: now + SHOW_MS } : next;
  },
  tick(s, now, rng) {
    if (s.status === 'reveal') return s.revealUntil !== null && now >= s.revealUntil ? { ...s, status: 'done' } : s;
    if (s.status === 'done' || now < s.until) return s;
    if (s.status === 'dealing') return settle(s, now);
    if (s.status === 'push') return deal(s.hand + 1, now, rng);
    if (s.status === 'showing') return playTurn(s, now);
    // Out of time: anyone who hasn't picked stands.
    const choices = { ...s.choices };
    const timedOut = { ...s.timedOut };
    for (const side of ['a', 'b'] as Side[]) {
      if (isActive(s.hands[side]) && !choices[side]) {
        choices[side] = 'stand';
        timedOut[side] = true;
      }
    }
    return { ...s, status: 'showing', choices, timedOut, until: now + SHOW_MS };
  },
  result(s) {
    return s.status === 'done' ? s.winner : null;
  },
  project(s) {
    const shown = s.status === 'showing';
    return {
      status: s.status,
      hand: s.hand,
      turn: s.turn,
      hands: s.hands,
      locked: { a: s.choices.a !== null, b: s.choices.b !== null },
      shown: shown ? s.choices : noChoices(),
      timedOut: shown ? s.timedOut : { a: false, b: false },
      until: s.until,
      winner: s.winner,
    };
  },
};
