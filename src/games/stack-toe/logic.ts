import type { MinigameLogic, Outcome } from '../types';

type Side = 'a' | 'b';

/** 1 = small, 2 = medium, 3 = large. A tile can go on an empty square or on top of any smaller tile. */
export type Size = 1 | 2 | 3;
export const SIZES: Size[] = [1, 2, 3];
export const SIZE_NAME: Record<Size, string> = { 1: 'Small', 2: 'Medium', 3: 'Large' };

/**
 * Tiles of each size per player. Two of each (6 each, 12 in all) is enough to fill the 3×3 board and
 * still have tiles left to cover with, but only two larges each means nobody can lock down every key
 * square: a large can never be covered, so a third one would make whoever goes first too strong.
 */
export const TILES_PER_SIZE = 2;
export const TURN_MS = 20_000;
export const REVEAL_MS = 5_000;

export interface Tile {
  owner: Side;
  size: Size;
}

/** The nine squares, row by row. Each is a stack, bottom first: only the last tile shows. */
export type Board = Tile[][];

export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export const otherSide = (s: Side): Side => (s === 'a' ? 'b' : 'a');
export const top = (stack: Tile[]): Tile | null => stack[stack.length - 1] ?? null;

export const canPlace = (stack: Tile[], size: Size) => (top(stack)?.size ?? 0) < size;

/** Every move a player could make right now: a size they still hold onto a square it fits. */
export function legalMoves(board: Board, left: Record<Size, number>) {
  const moves: { size: Size; cell: number }[] = [];
  for (const size of SIZES) {
    if (left[size] <= 0) continue;
    board.forEach((stack, cell) => canPlace(stack, size) && moves.push({ size, cell }));
  }
  return moves;
}

/** The three squares of a row that side owns on top, if any. */
export function lineOf(board: Board, side: Side): number[] | null {
  return LINES.find((line) => line.every((i) => top(board[i])?.owner === side)) ?? null;
}

export interface StackToeState {
  status: 'playing' | 'reveal' | 'done';
  board: Board;
  left: Record<Side, Record<Size, number>>;
  turn: Side;
  /** Who went first, picked at random so neither seat always gets the head start. */
  first: Side;
  turnEndsAt: number;
  /** The last square played, so screens can show it. */
  last: { cell: number; auto: boolean } | null;
  winLine: number[] | null;
  revealUntil: number | null;
  winner: Outcome | null;
}

export interface StackToeView {
  status: StackToeState['status'];
  /** Only the tile on top of each square, plus how many are under it. */
  cells: { top: Tile | null; under: number }[];
  left: Record<Side, Record<Size, number>>;
  turn: Side;
  first: Side;
  turnEndsAt: number;
  last: StackToeState['last'];
  winLine: number[] | null;
  winner: Outcome | null;
}

const fullHand = (): Record<Size, number> => ({ 1: TILES_PER_SIZE, 2: TILES_PER_SIZE, 3: TILES_PER_SIZE });

const finish = (s: StackToeState, winner: Outcome, winLine: number[] | null, now: number): StackToeState => ({
  ...s,
  status: 'reveal',
  winner,
  winLine,
  revealUntil: now + REVEAL_MS,
});

function place(s: StackToeState, side: Side, size: Size, cell: number, now: number, auto: boolean): StackToeState {
  const board = s.board.map((stack, i) => (i === cell ? [...stack, { owner: side, size }] : stack));
  const left = { ...s.left, [side]: { ...s.left[side], [size]: s.left[side][size] - 1 } };
  const next: StackToeState = { ...s, board, left, last: { cell, auto } };
  // Placing only ever covers, so a new line can only be the mover's.
  const line = lineOf(board, side);
  if (line) return finish(next, side, line, now);
  // Next player's turn. If they're stuck (no tiles, or none big enough) the turn comes back; if nobody can move it's a draw.
  const other = otherSide(side);
  if (legalMoves(board, left[other]).length) return { ...next, turn: other, turnEndsAt: now + TURN_MS };
  if (legalMoves(board, left[side]).length) return { ...next, turn: side, turnEndsAt: now + TURN_MS };
  return finish(next, 'draw', null, now);
}

export const stackToeLogic: MinigameLogic<StackToeState, StackToeView> = {
  info: {
    id: 'stack-toe',
    name: 'Tic-STACK-toe',
    shortName: 'Tic-STACK-toe',
    rules: `Take turns placing your coloured tiles on the 3×3 board. A bigger tile can cover any smaller one! You each have ${TILES_PER_SIZE} small, ${TILES_PER_SIZE} medium and ${TILES_PER_SIZE} large. A random player goes first. Three in a row on top wins!`,
    refereeDuty: 'Nothing to judge: the game scores itself. Just watch the board!',
    icon: '🧱',
    color: '#ff8a3d',
    category: 'puzzle',
    scoring: 'auto',
  },
  init(now, rng) {
    const first: Side = rng() < 0.5 ? 'a' : 'b';
    return {
      status: 'playing',
      board: Array.from({ length: 9 }, () => []),
      left: { a: fullHand(), b: fullHand() },
      turn: first,
      first,
      turnEndsAt: now + TURN_MS,
      last: null,
      winLine: null,
      revealUntil: null,
      winner: null,
    };
  },
  onInput(s, role, payload, now) {
    if (s.status !== 'playing' || role !== s.turn || payload?.action !== 'place') return s;
    const size = Number(payload.size) as Size;
    const cell = Number(payload.cell);
    if (!SIZES.includes(size) || !Number.isInteger(cell) || cell < 0 || cell > 8) return s;
    if (s.left[role][size] <= 0 || !canPlace(s.board[cell], size)) return s;
    return place(s, role, size, cell, now, false);
  },
  tick(s, now, rng) {
    if (s.status === 'playing' && now >= s.turnEndsAt) {
      // Out of time: a random legal tile goes down for them, so the game never stalls.
      const moves = legalMoves(s.board, s.left[s.turn]);
      const m = moves[Math.floor(rng() * moves.length)];
      return place(s, s.turn, m.size, m.cell, now, true);
    }
    if (s.status === 'reveal' && s.revealUntil !== null && now >= s.revealUntil) return { ...s, status: 'done' };
    return s;
  },
  result(s) {
    return s.status === 'done' ? s.winner : null;
  },
  project(s) {
    return {
      status: s.status,
      cells: s.board.map((stack) => ({ top: top(stack), under: Math.max(0, stack.length - 1) })),
      left: s.left,
      turn: s.turn,
      first: s.first,
      turnEndsAt: s.turnEndsAt,
      last: s.last,
      winLine: s.winLine,
      winner: s.status === 'playing' ? null : s.winner,
    };
  },
};
