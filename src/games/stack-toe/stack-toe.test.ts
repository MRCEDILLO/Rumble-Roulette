import { describe, expect, it } from 'vitest';
import { REVEAL_MS, TILES_PER_SIZE, TURN_MS, stackToeLogic as logic, type StackToeState } from './logic';

/** rng() < 0.5 means a goes first. */
const aFirst = () => 0;
const bFirst = () => 0.9;

function moves(s: StackToeState, list: [side: 'a' | 'b', size: number, cell: number][]) {
  for (const [side, size, cell] of list) s = logic.onInput(s, side, { action: 'place', size, cell }, 1000, aFirst);
  return s;
}

const settle = (s: StackToeState) => logic.tick!(s, 1000 + REVEAL_MS, aFirst);

describe('Tic-STACK-toe', () => {
  it('a random duelist goes first, and only they can move', () => {
    expect(logic.init(0, aFirst).turn).toBe('a');
    const s = logic.init(0, bFirst);
    expect(s.turn).toBe('b');
    expect(logic.onInput(s, 'a', { action: 'place', size: 3, cell: 4 }, 0, aFirst)).toBe(s);
  });

  it('each duelist starts with two of each size', () => {
    const s = logic.init(0, aFirst);
    expect(s.left.a).toEqual({ 1: TILES_PER_SIZE, 2: TILES_PER_SIZE, 3: TILES_PER_SIZE });
    expect(TILES_PER_SIZE).toBe(2);
  });

  it('bigger tiles cover smaller ones, never the other way', () => {
    let s = moves(logic.init(0, aFirst), [['a', 2, 4]]);
    const blocked = logic.onInput(s, 'b', { action: 'place', size: 2, cell: 4 }, 1000, aFirst);
    expect(blocked).toBe(s);
    s = moves(s, [['b', 3, 4]]);
    expect(s.board[4].map((t) => t.owner)).toEqual(['a', 'b']);
    expect(logic.project(s).cells[4]).toEqual({ top: { owner: 'b', size: 3 }, under: 1 });
  });

  it('you can’t play a size you’ve run out of', () => {
    const s = moves(logic.init(0, aFirst), [['a', 3, 0], ['b', 1, 1], ['a', 3, 2], ['b', 1, 3]]);
    expect(s.left.a[3]).toBe(0);
    expect(logic.onInput(s, 'a', { action: 'place', size: 3, cell: 5 }, 1000, aFirst)).toBe(s);
  });

  it('three in a row on top wins, and covering breaks a line', () => {
    let s = moves(logic.init(0, aFirst), [['a', 1, 0], ['b', 1, 3], ['a', 1, 1], ['b', 2, 1]]);
    expect(s.board[1].map((t) => t.owner)).toEqual(['a', 'b']);
    s = moves(s, [['a', 3, 4], ['b', 1, 5]]);
    expect(s.status).toBe('playing');
    s = moves(s, [['a', 3, 8]]);
    expect(s.status).toBe('reveal');
    expect(s.winLine).toEqual([0, 4, 8]);
    expect(logic.result(s)).toBeNull();
    expect(logic.result(settle(s))).toBe('a');
  });

  /** A state with these tops (a/b, small tiles) and these tiles left in hand. */
  function setup(tops: string, left: { a: number[]; b: number[] }, turn: 'a' | 'b'): StackToeState {
    const s = logic.init(0, turn === 'a' ? aFirst : bFirst);
    const board = tops.split('').map((c) => (c === '.' ? [] : [{ owner: c as 'a' | 'b', size: 1 as const }]));
    const hand = (n: number[]) => ({ 1: n[0], 2: n[1], 3: n[2] });
    return { ...s, board, left: { a: hand(left.a), b: hand(left.b) } };
  }

  it('a full board with no line and no moves left is a draw', () => {
    const s = setup('abaabbba.', { a: [0, 1, 0], b: [0, 0, 0] }, 'a');
    const t = moves(s, [['a', 2, 8]]);
    expect(t.status).toBe('reveal');
    expect(t.winner).toBe('draw');
  });

  it('if you can’t move, your turn is skipped', () => {
    // a only has smalls and every square is taken, so after b moves it's b again.
    const s = setup('abaabbba.', { a: [1, 0, 0], b: [0, 1, 1] }, 'b');
    const t = moves(s, [['b', 2, 8]]);
    expect(t.status).toBe('playing');
    expect(t.turn).toBe('b');
  });

  it('a timeout puts a random tile down and passes the turn', () => {
    const s = logic.init(0, aFirst);
    const t = logic.tick!(s, TURN_MS, aFirst);
    expect(t.board.flat()).toHaveLength(1);
    expect(t.last?.auto).toBe(true);
    expect(t.turn).toBe('b');
  });
});
