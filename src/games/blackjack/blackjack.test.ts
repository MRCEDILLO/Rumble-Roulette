import { describe, expect, it } from 'vitest';
import {
  CHOOSE_MS,
  DEAL_MS,
  PUSH_MS,
  REVEAL_MS,
  SHOW_MS,
  blackjackLogic as logic,
  freshDeck,
  handTotal,
  type BlackjackState,
  type Card,
  type Rank,
} from './logic';

const c = (rank: Rank): Card => ({ rank, suit: 'spades' });
const cards = (...ranks: Rank[]) => ranks.map(c);

/** A hand on the table with chosen cards, and the next cards to come off the deck (first listed is dealt first). */
function table(a: Rank[], b: Rank[], next: Rank[] = []): BlackjackState {
  const s = logic.init(0, Math.random);
  return logic.tick!(
    { ...s, hands: { a: { cards: cards(...a), stood: false }, b: { cards: cards(...b), stood: false } }, deck: cards(...next).reverse() },
    DEAL_MS,
    Math.random,
  );
}
const pick = (s: BlackjackState, side: 'a' | 'b', choice: 'hit' | 'stand', now = s.until - CHOOSE_MS + 100) =>
  logic.onInput(s, side, { choice, turn: s.turn }, now, Math.random);
/** Lets the picks show, then plays the turn. */
const play = (s: BlackjackState) => logic.tick!(s, s.until, Math.random);

describe('Blackjack', () => {
  it('uses a full 52-card deck with every card once', () => {
    const deck = freshDeck(Math.random);
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((d) => `${d.rank}${d.suit}`)).size).toBe(52);
  });

  it('counts picture cards as 10 and an Ace as 11 unless that would bust', () => {
    expect(handTotal(cards('K', 'Q'))).toEqual({ total: 20, soft: false });
    expect(handTotal(cards('A', '6'))).toEqual({ total: 17, soft: true });
    expect(handTotal(cards('A', '6', '9'))).toEqual({ total: 16, soft: false });
    expect(handTotal(cards('A', 'A', '9'))).toEqual({ total: 21, soft: true });
    expect(handTotal(cards('A', 'K'))).toEqual({ total: 21, soft: true });
  });

  it('deals two cards each from one deck, then asks both for a pick', () => {
    let s = logic.init(0, Math.random);
    expect(s.status).toBe('dealing');
    expect(s.hands.a.cards).toHaveLength(2);
    expect(s.hands.b.cards).toHaveLength(2);
    expect(s.deck).toHaveLength(48);
    s = logic.tick!(s, DEAL_MS, Math.random);
    // Unless someone was dealt 21, it's time to choose.
    if (s.status === 'choosing') {
      expect(s.turn).toBe(1);
      expect(s.until).toBe(DEAL_MS + CHOOSE_MS);
    }
  });

  it('keeps picks secret until both have chosen, and a pick cannot be changed', () => {
    let s = table(['9', '5'], ['10', '4'], ['3', '2']);
    s = pick(s, 'a', 'hit');
    expect(logic.project(s).locked).toEqual({ a: true, b: false });
    expect(logic.project(s).shown).toEqual({ a: null, b: null });
    s = pick(s, 'a', 'stand');
    expect(s.choices.a).toBe('hit');
    s = pick(s, 'b', 'stand');
    expect(s.status).toBe('showing');
    expect(logic.project(s).shown).toEqual({ a: 'hit', b: 'stand' });
    s = play(s);
    // A took the 3, B stood.
    expect(s.hands.a.cards.map((x) => x.rank)).toEqual(['9', '5', '3']);
    expect(s.hands.b.stood).toBe(true);
    expect(s.status).toBe('choosing');
    expect(s.turn).toBe(2);
  });

  it('the one still playing keeps choosing alone, and the higher total wins', () => {
    let s = table(['10', '7'], ['10', '4'], ['5']);
    s = play(pick(pick(s, 'a', 'stand'), 'b', 'hit'));
    expect(handTotal(s.hands.b.cards).total).toBe(19);
    expect(s.status).toBe('choosing');
    s = pick(s, 'a', 'hit');
    expect(s.choices.a).toBeNull();
    s = play(pick(s, 'b', 'stand'));
    expect(s.status).toBe('reveal');
    expect(s.winner).toBe('b');
    s = logic.tick!(s, s.revealUntil! + REVEAL_MS, Math.random);
    expect(logic.result(s)).toBe('b');
  });

  it('going over 21 loses straight away', () => {
    let s = table(['10', '6'], ['10', '2'], ['9', '3']);
    s = play(pick(pick(s, 'a', 'hit'), 'b', 'hit'));
    expect(s.status).toBe('reveal');
    expect(s.winner).toBe('b');
  });

  it('a tie or a double bust deals a fresh hand instead of a draw', () => {
    let s = table(['10', '8'], ['9', '9']);
    s = play(pick(pick(s, 'a', 'stand'), 'b', 'stand'));
    expect(s.status).toBe('push');
    expect(logic.result(s)).toBeNull();
    s = logic.tick!(s, s.until + PUSH_MS, Math.random);
    expect(s.status).toBe('dealing');
    expect(s.hand).toBe(2);
    expect(s.deck).toHaveLength(48);

    s = table(['10', '6'], ['10', '5'], ['10', '9']);
    s = play(pick(pick(s, 'a', 'hit'), 'b', 'hit'));
    expect(s.status).toBe('push');
  });

  it('21 stops taking cards, and running out of time counts as Stand', () => {
    let s = table(['A', '5'], ['10', '3'], ['5']);
    s = play(pick(pick(s, 'a', 'hit'), 'b', 'stand'));
    // A hit to 21 and B has stood: nobody is left to choose.
    expect(s.status).toBe('reveal');
    expect(s.winner).toBe('a');

    s = table(['10', '2'], ['10', '3']);
    s = pick(s, 'a', 'hit');
    s = logic.tick!(s, s.until, Math.random);
    expect(s.status).toBe('showing');
    expect(s.choices.b).toBe('stand');
    expect(logic.project(s).timedOut).toEqual({ a: false, b: true });
  });

  it('ignores picks from anyone but the duelists and picks for an old turn', () => {
    let s = table(['10', '2'], ['10', '3']);
    s = logic.onInput(s, 'ref', { choice: 'hit' }, s.until - CHOOSE_MS, Math.random);
    s = logic.onInput(s, 'a', { choice: 'hit', turn: s.turn - 1 }, s.until - CHOOSE_MS, Math.random);
    expect(s.choices).toEqual({ a: null, b: null });
    expect(SHOW_MS).toBeLessThan(CHOOSE_MS);
  });
});
