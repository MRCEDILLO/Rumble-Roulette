import { describe, expect, it } from 'vitest';
import { MATCH_SHOW_MS, PAIRS, REVEAL_MS, SHOW_MS, TURN_MS, memoryFlipLogic as logic, type MemoryFlipState } from './logic';

/** rng() < 0.5 means a goes first. */
const aFirst = () => 0;
const bFirst = () => 0.9;

const flip = (s: MemoryFlipState, side: 'a' | 'b', card: number, now = 0) => logic.onInput(s, side, { action: 'flip', card }, now, aFirst);

/** Two cards that match, and one that doesn't match the first. */
function pairAndMiss(s: MemoryFlipState) {
  const x = 0;
  const y = s.cards.findIndex((c, i) => i !== x && c === s.cards[x]);
  const z = s.cards.findIndex((c) => c !== s.cards[x]);
  return { x, y, z };
}

describe('Memory Flip', () => {
  it('deals 8 shuffled pairs and a random duelist goes first', () => {
    const s = logic.init(0, Math.random);
    expect(s.cards).toHaveLength(PAIRS * 2);
    for (const shape of new Set(s.cards)) expect(s.cards.filter((c) => c === shape)).toHaveLength(2);
    expect(logic.init(0, aFirst).turn).toBe('a');
    expect(logic.init(0, bFirst).turn).toBe('b');
  });

  it('only face-up cards show their shape to phones', () => {
    let s = logic.init(0, aFirst);
    expect(logic.project(s).cards.every((c) => c.shape === null)).toBe(true);
    s = flip(s, 'a', 3);
    const cards = logic.project(s).cards;
    expect(cards[3].shape).toBe(s.cards[3]);
    expect(cards.filter((c) => c.shape)).toHaveLength(1);
  });

  it('only the player whose turn it is can flip, and not the same card twice', () => {
    const s = logic.init(0, aFirst);
    expect(flip(s, 'b', 0)).toBe(s);
    const t = flip(s, 'a', 0);
    expect(flip(t, 'a', 0)).toBe(t);
  });

  it('a miss flips back and passes the turn', () => {
    let s = logic.init(0, aFirst);
    const { x, z } = pairAndMiss(s);
    s = flip(flip(s, 'a', x), 'a', z);
    expect(s.status).toBe('showing');
    expect(flip(s, 'a', 5)).toBe(s);
    s = logic.tick!(s, SHOW_MS, aFirst);
    expect(s.status).toBe('playing');
    expect(s.turn).toBe('b');
    expect(logic.project(s).cards.every((c) => !c.up)).toBe(true);
  });

  it('a match keeps the pair and goes again', () => {
    let s = logic.init(0, aFirst);
    const { x, y } = pairAndMiss(s);
    s = flip(flip(s, 'a', x), 'a', y);
    s = logic.tick!(s, MATCH_SHOW_MS, aFirst);
    expect(s.turn).toBe('a');
    expect(logic.project(s).pairs).toEqual({ a: 1, b: 0 });
    expect(logic.project(s).cards[x]).toMatchObject({ up: true, taken: 'a' });
    expect(flip(s, 'a', y)).toBe(s);
  });

  /** Plays the whole board, giving each side `aPairs` and the rest. */
  function playOut(aPairs: number) {
    let s = logic.init(0, aFirst);
    const shapes = [...new Set(s.cards)];
    shapes.forEach((shape, n) => {
      const side = n < aPairs ? 'a' : 'b';
      if (s.turn !== side) {
        // Hand the turn over with a miss.
        const open = s.cards.map((_, i) => i).filter((i) => s.taken[i] === null);
        const x = open[0];
        const z = open.find((i) => s.cards[i] !== s.cards[x])!;
        s = logic.tick!(flip(flip(s, s.turn, x), s.turn, z), 1e9, aFirst);
      }
      const [x, y] = s.cards.map((c, i) => (c === shape ? i : -1)).filter((i) => i >= 0);
      s = logic.tick!(flip(flip(s, side, x), side, y), 1e9, aFirst);
    });
    return s;
  }

  it('most pairs wins once every pair is found', () => {
    const s = playOut(5);
    expect(s.status).toBe('reveal');
    expect(logic.result(s)).toBeNull();
    expect(logic.result(logic.tick!(s, 1e9 + REVEAL_MS, aFirst))).toBe('a');
    expect(logic.result(logic.tick!(playOut(2), 2e9, aFirst))).toBe('b');
  });

  it('a tie on pairs is a draw (the duel is replayed)', () => {
    const s = playOut(PAIRS / 2);
    expect(s.winner).toBe('draw');
  });

  it('running out of time flips cards at random and passes the turn on a miss', () => {
    const s = logic.init(0, aFirst);
    let t = logic.tick!(s, TURN_MS, () => 0);
    expect(t.status).toBe('showing');
    expect(t.flipped).toHaveLength(2);
    expect(t.last?.auto).toBe(true);
    t = logic.tick!(t, TURN_MS + SHOW_MS, aFirst);
    expect(t.turn).toBe(t.last?.match ? 'a' : 'b');
  });
});
