import { describe, expect, it } from 'vitest';
import {
  BET_MS,
  PICK_MS,
  SPIN_MS,
  START_COINS,
  addSeat,
  applyInput,
  changeLook,
  createState,
  hostEndRounds,
  hostFreeStart,
  project,
  refAction,
  removeSeat,
  startGame,
  tick,
} from './engine';
import type { EngineState } from './types';

function seededRng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 1_000_000) / 1_000_000;
  };
}

const COLORS = ['red', 'blue', 'green', 'yellow', 'pink', 'cyan', 'lime', 'white', 'black', 'brown'];

function setup(players: number, rounds = 10, games = ['rps', 'timer'], seed = 1) {
  const rng = seededRng(seed);
  let s = createState('ABCD', 'party', rounds, games, 0);
  for (let i = 0; i < players; i++) {
    s = addSeat(s, `p${i}`, `prof${i}`, { name: `P${i}`, color: COLORS[i], accessory: 'none' }, 0, rng);
  }
  return { s, rng };
}

/** Advance through pick + spin so the round is in betting (or duel for specials). */
function toBetting(s: EngineState, now: number, rng: () => number) {
  s = tick(s, now + PICK_MS, rng);
  s = tick(s, now + PICK_MS + SPIN_MS, rng);
  return s;
}

/** Start the game if it's waiting on the Host, then play the Timer/RPS duel to a win for side `side`. */
function winDuel(s: EngineState, side: 'a' | 'b', now: number, rng: () => number): EngineState {
  if (s.phase === 'ready') s = refAction(s, 'start', now, rng);
  const d = s.duel!;
  if (d.gameId === 'timer') {
    s = applyInput(s, d.ref!, { t: 'game', payload: { action: 'start' } }, now, rng);
    s = applyInput(s, d.ref!, { t: 'game', payload: { action: 'stop', elapsedMs: 5000 } }, now + 5000, rng);
    return applyInput(s, d.ref!, { t: 'game', payload: { action: 'judge', winner: side } }, now + 6000, rng);
  }
  let t = now;
  while (s.phase === 'duel') {
    const win = side === 'a' ? { a: 'rock', b: 'scissors' } : { a: 'scissors', b: 'rock' };
    s = applyInput(s, d.a, { t: 'game', payload: { pick: win.a } }, t, rng);
    s = applyInput(s, d.b, { t: 'game', payload: { pick: win.b } }, t, rng);
    t += 10_000;
    s = tick(s, t, rng);
  }
  return s;
}

describe('fair selection', () => {
  it('gives everyone the same number of duels when it divides evenly', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      let { s, rng } = setup(5, 10, ['rps', 'timer'], seed);
      s = startGame(s, 0, rng);
      const duels: Record<string, number> = {};
      const refs: Record<string, number> = Object.fromEntries(s.order.map((id) => [id, 0]));
      let now = 0;
      for (let r = 0; r < 10; r++) {
        const d = s.duel!;
        expect(d.a).not.toBe(d.b);
        expect([d.a, d.b]).not.toContain(d.ref);
        duels[d.a] = (duels[d.a] ?? 0) + 1;
        duels[d.b] = (duels[d.b] ?? 0) + 1;
        refs[d.ref!] = (refs[d.ref!] ?? 0) + 1;
        s = toBetting(s, now, rng);
        now += PICK_MS + SPIN_MS + BET_MS;
        s = tick(s, now, rng);
        s = winDuel(s, 'a', now, rng);
        expect(s.phase).toBe('result');
        s = refAction(s, 'next', now, rng);
        now += 1000;
      }
      expect(Object.values(duels)).toEqual([4, 4, 4, 4, 4]);
      const refCounts = Object.values(refs);
      expect(refCounts).toEqual([2, 2, 2, 2, 2]);
    }
  });

  it('keeps duel counts within one of each other when it does not divide evenly', () => {
    let { s, rng } = setup(4, 7, ['rps'], 9);
    s = startGame(s, 0, rng);
    const duels: Record<string, number> = {};
    let now = 0;
    for (let r = 0; r < 7; r++) {
      duels[s.duel!.a] = (duels[s.duel!.a] ?? 0) + 1;
      duels[s.duel!.b] = (duels[s.duel!.b] ?? 0) + 1;
      s = toBetting(s, now, rng);
      now += 100_000;
      s = tick(s, now, rng);
      s = winDuel(s, 'b', now, rng);
      s = refAction(s, 'next', now, rng);
    }
    const counts = Object.values(duels);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });
});

describe('betting', () => {
  it('pays the winner +2 and settles bets', () => {
    let { s, rng } = setup(4, 10, ['rps']);
    s = startGame(s, 0, rng);
    s = toBetting(s, 0, rng);
    expect(s.phase).toBe('bet');
    const [x, y] = s.order.filter((id) => id !== s.duel!.a && id !== s.duel!.b);
    s = applyInput(s, x, { t: 'bet', on: 'a', amount: 3 }, 1, rng);
    expect(project(s, [], 1).bets).toBeNull();
    s = applyInput(s, x, { t: 'bet', on: 'b', amount: 1 }, 1, rng); // no changing
    expect(s.bets[x]).toEqual({ on: 'a', amount: 3, auto: false });
    s = applyInput(s, y, { t: 'bet', on: 'b', amount: 2 }, 1, rng);
    expect(s.phase).toBe('ready'); // everyone locked in, so no need to wait
    s = winDuel(s, 'a', 2, rng);
    expect(s.seats[s.duel!.a].coins).toBe(START_COINS + 2);
    expect(s.seats[s.duel!.b].coins).toBe(START_COINS);
    expect(s.seats[x].coins).toBe(START_COINS + 3);
    expect(s.seats[y].coins).toBe(START_COINS - 2);
    expect(project(s, [], 3).bets).not.toBeNull();
  });

  it('rejects bets over 3 or over your coins, and auto-bets 1 at the deadline', () => {
    let { s, rng } = setup(3, 10, ['rps']);
    s = startGame(s, 0, rng);
    s = toBetting(s, 0, rng);
    const [x] = s.order.filter((id) => id !== s.duel!.a && id !== s.duel!.b);
    s = applyInput(s, x, { t: 'bet', on: 'a', amount: 4 }, 1, rng);
    s = applyInput(s, x, { t: 'bet', on: 'a', amount: 0 }, 1, rng);
    expect(s.bets[x]).toBeUndefined();
    s = tick(s, PICK_MS + SPIN_MS + BET_MS, rng);
    expect(s.phase).toBe('ready');
    expect(s.bets[x]).toMatchObject({ amount: 1, auto: true });
  });

  it('gives a broke bettor 1 coin and never goes negative', () => {
    let { s, rng } = setup(3, 10, ['rps']);
    for (const id of s.order) s.seats[id].coins = 0;
    s = startGame(s, 0, rng);
    const [x] = s.order.filter((id) => id !== s.duel!.a && id !== s.duel!.b);
    expect(s.seats[x].coins).toBe(1);
    expect(s.gifted).toEqual([x]);
    s = toBetting(s, 0, rng);
    s = applyInput(s, x, { t: 'bet', on: 'b', amount: 1 }, 1, rng);
    s = winDuel(s, 'a', 2, rng);
    expect(s.seats[x].coins).toBe(0);
  });

  it('keeps bets on a redo and cancels them on a skipped game', () => {
    let { s, rng } = setup(3, 10, ['rps', 'timer']);
    s = startGame(s, 0, rng);
    s = toBetting(s, 0, rng);
    const [x] = s.order.filter((id) => id !== s.duel!.a && id !== s.duel!.b);
    s = applyInput(s, x, { t: 'bet', on: 'a', amount: 2 }, 1, rng);
    s = refAction(s, 'start', 2, rng);
    expect(s.phase).toBe('duel');
    s = refAction(s, 'redo', 2, rng);
    expect(s.phase).toBe('ready');
    expect(s.bets[x]).toBeDefined();
    const before = s.duel!.gameId;
    s = refAction(s, 'skipGame', 3, rng);
    expect(s.phase).toBe('spin');
    expect(s.duel!.gameId).not.toBe(before);
    expect(s.bets).toEqual({});
  });

  it('waits on the instructions until the round Host starts the game', () => {
    let { s, rng } = setup(4, 10, ['rps']);
    s = startGame(s, 0, rng);
    s = toBetting(s, 0, rng);
    s = tick(s, PICK_MS + SPIN_MS + BET_MS, rng);
    expect(s.phase).toBe('ready');
    expect(s.duel!.game).toBeNull();
    s = tick(s, 1e9, rng);
    expect(s.phase).toBe('ready'); // no timer: it waits for the Host
    const d = s.duel!;
    const bettor = s.order.find((id) => id !== d.a && id !== d.b && id !== d.ref)!;
    for (const id of [d.a, bettor]) expect(applyInput(s, id, { t: 'ref', action: 'start' }, 1, rng)).toBe(s);
    s = applyInput(s, d.ref!, { t: 'ref', action: 'start' }, 2, rng);
    expect(s.phase).toBe('duel');
    expect(s.duel!.game).not.toBeNull();
    expect(applyInput(s, d.ref!, { t: 'ref', action: 'start' }, 3, rng)).toBe(s); // only once
  });

  it('only lets the referee use referee controls', () => {
    let { s, rng } = setup(3, 10, ['rps']);
    s = startGame(s, 0, rng);
    const notRef = s.duel!.a;
    const after = applyInput(s, notRef, { t: 'ref', action: 'skipRound' }, 1, rng);
    expect(after).toBe(s);
  });
});

describe('referee-judged games', () => {
  it('lets the referee judge a draw and redo it', () => {
    let { s, rng } = setup(3, 10, ['timer']);
    s = startGame(s, 0, rng);
    s = toBetting(s, 0, rng);
    s = tick(s, 1e9, rng);
    const ref = s.duel!.ref!;
    s = applyInput(s, ref, { t: 'ref', action: 'start' }, 1, rng);
    s = applyInput(s, ref, { t: 'game', payload: { action: 'start' } }, 1, rng);
    s = applyInput(s, ref, { t: 'game', payload: { action: 'stop', elapsedMs: 12345 } }, 2, rng);
    expect(project(s, [], 2).duel!.view.elapsedMs).toBeNull(); // hidden until judged
    s = applyInput(s, ref, { t: 'game', payload: { action: 'judge', winner: 'draw' } }, 3, rng);
    expect(s.phase).toBe('result');
    expect(s.roundsPlayed).toBe(0);
    s = refAction(s, 'next', 4, rng); // not allowed on a draw
    expect(s.phase).toBe('result');
    s = refAction(s, 'redo', 4, rng);
    expect(s.phase).toBe('ready');
    s = refAction(s, 'start', 5, rng);
    expect(s.duel!.game.status).toBe('ready');
  });

  it('auto-scored games cannot be judged by the referee', () => {
    let { s, rng } = setup(3, 10, ['rps']);
    s = startGame(s, 0, rng);
    s = toBetting(s, 0, rng);
    s = tick(s, 1e9, rng);
    const ref = s.duel!.ref!;
    s = applyInput(s, ref, { t: 'ref', action: 'start' }, 1, rng);
    const after = applyInput(s, ref, { t: 'game', payload: { pick: 'rock' } }, 1, rng);
    expect(after).toBe(s);
  });
});

describe('skipping and leaving', () => {
  it('skip round changes no coins and does not count', () => {
    let { s, rng } = setup(3, 10, ['rps']);
    for (const id of s.order) s.seats[id].coins = 0;
    s = startGame(s, 0, rng);
    s = refAction(s, 'skipRound', 1, rng);
    expect(s.roundsPlayed).toBe(0);
    expect(s.phase).toBe('pick');
    // the gift from the skipped round was taken back before the new round gave its own
    expect(Object.values(s.seats).reduce((n, seat) => n + seat.coins, 0)).toBe(1);
  });

  it('pauses below 3 players and continues when someone joins', () => {
    let { s, rng } = setup(3, 10, ['rps']);
    s = startGame(s, 0, rng);
    s = removeSeat(s, s.duel!.a, 1, rng);
    expect(s.phase).toBe('paused');
    s = addSeat(s, 'late', 'profLate', { name: 'Late', color: 'pink', accessory: 'none' }, 2, rng);
    expect(s.seats.late.coins).toBe(START_COINS);
  });

  it('hands a seat to the same profile on a new phone once the old one disconnects', () => {
    let { s, rng } = setup(3);
    s = addSeat(s, 'newPhone', 'prof0', { name: 'P0', color: 'red', accessory: 'none' }, 1, rng);
    expect(s.seats.newPhone).toBeUndefined();
    expect(s.rejects.newPhone).toBeDefined();
    s.seats.p0.connected = false;
    s = addSeat(s, 'newPhone', 'prof0', { name: 'P0', color: 'red', accessory: 'none' }, 1, rng);
    expect(s.seats.newPhone.profileId).toBe('prof0');
    expect(s.seats.p0).toBeUndefined();
    expect(s.order).toContain('newPhone');
  });

  it('lets two players share a colour', () => {
    let { s, rng } = setup(3);
    s = addSeat(s, 'x', 'profX', { name: 'X', color: 'red', accessory: 'none' }, 1, rng);
    expect(s.seats.x.color).toBe('red');
    expect(s.seats.p0.color).toBe('red');
  });
});

describe('changing look in the lobby', () => {
  it('updates colour and accessory', () => {
    let { s } = setup(3);
    s = changeLook(s, 'p0', { color: 'purple', accessory: 'crown' });
    expect(s.seats.p0.color).toBe('purple');
    expect(s.seats.p0.accessory).toBe('crown');
  });

  it("allows another player's colour", () => {
    let { s } = setup(3);
    s = changeLook(s, 'p0', { color: 'blue', accessory: 'none' });
    expect(s.seats.p0.color).toBe('blue');
    expect(s.seats.p1.color).toBe('blue');
    expect(s.rejects.p0).toBeUndefined();
  });

  it('is ignored once the game has started', () => {
    let { s, rng } = setup(3);
    s = startGame(s, 0, rng);
    s = changeLook(s, 'p0', { color: 'purple', accessory: 'none' });
    expect(s.seats.p0.color).toBe('red');
  });
});

describe('the final', () => {
  it('sends the two richest players to the final with no betting', () => {
    let { s, rng } = setup(4, 10, ['rps']);
    s = startGame(s, 0, rng);
    const coins = [20, 15, 10, 5];
    s.order.forEach((id, i) => (s.seats[id].coins = coins[i]));
    s = hostEndRounds(s, 1, rng);
    expect(s.duel!.kind).toBe('final');
    expect(new Set([s.duel!.a, s.duel!.b])).toEqual(new Set([s.order[0], s.order[1]]));
    s = toBetting(s, 1, rng);
    expect(s.phase).toBe('ready');
    const winnerSide = s.duel!.a === s.order[1] ? 'a' : 'b';
    s = winDuel(s, winnerSide, 2, rng);
    s = refAction(s, 'next', 3, rng);
    expect(s.phase).toBe('end');
    expect(s.champion).toBe(s.order[1]); // crowned whatever their coins
    expect(s.seats[s.order[1]].coins).toBe(15); // no +2 in the final
  });

  it('runs a tie-break when players tie for a final spot', () => {
    let { s, rng } = setup(5, 10, ['rps']);
    s = startGame(s, 0, rng);
    const coins = [20, 10, 10, 10, 2];
    s.order.forEach((id, i) => (s.seats[id].coins = coins[i]));
    s = hostEndRounds(s, 1, rng);
    expect(s.finals).toMatchObject({ locked: [s.order[0]], slots: 1 });
    expect(s.duel!.kind).toBe('tiebreak');
    let t = 2;
    let guard = 0;
    while (s.duel?.kind === 'tiebreak' && guard++ < 5) {
      s = toBetting(s, t, rng);
      s = winDuel(s, 'a', t, rng);
      s = refAction(s, 'next', t, rng);
      t += 100;
    }
    expect(guard).toBe(2); // three tied for one spot → two knockout tie-breaks
    expect(s.duel!.kind).toBe('final');
    expect([s.duel!.a, s.duel!.b]).toContain(s.order[0]);
  });

  it('computes awards at the end', () => {
    let { s, rng } = setup(3, 1, ['rps']);
    s = startGame(s, 0, rng);
    s = toBetting(s, 0, rng);
    const [x] = s.order.filter((id) => id !== s.duel!.a && id !== s.duel!.b);
    const roundWinner = s.duel!.a;
    s = applyInput(s, x, { t: 'bet', on: 'a', amount: 3 }, 1, rng);
    s = winDuel(s, 'a', 2, rng);
    s = refAction(s, 'next', 3, rng);
    expect(s.awards).toEqual([]);
    // finish the final (and any tie-break) with side a winning
    let t = 10;
    while (s.phase !== 'end') {
      s = toBetting(s, t, rng);
      s = winDuel(s, 'a', t, rng);
      s = refAction(s, 'next', t, rng);
      t += 100;
    }
    const fav = s.awards.find((a) => a.id === 'favourite')!;
    expect(fav.seats).toEqual([roundWinner]);
    expect(s.awards.find((a) => a.id === 'bettor')!.seats).toEqual([x]);
  });
});

describe('free play', () => {
  it('plays a chosen game with no coins and returns to the menu', () => {
    const rng = seededRng(4);
    let s = createState('FREE', 'free', 0, ['rps', 'timer'], 0);
    s = addSeat(s, 'p0', 'a', { name: 'A', color: 'red', accessory: 'none' }, 0, rng);
    s = addSeat(s, 'p1', 'b', { name: 'B', color: 'blue', accessory: 'none' }, 0, rng);
    // Every game needs a Host, so two players can't start.
    expect(startGame(s, 0, rng).phase).toBe('lobby');
    s = addSeat(s, 'p2', 'c', { name: 'C', color: 'green', accessory: 'none' }, 0, rng);
    s = startGame(s, 0, rng);
    expect(s.phase).toBe('freeMenu');
    s = hostFreeStart(s, { gameId: 'rps', a: 'p0', b: 'p1', ref: null, spin: false }, 1, rng);
    expect(s.phase).toBe('ready');
    // No Host picked: the third player gets it, even for a self-scoring game.
    expect(s.duel!.ref).toBe('p2');
    s = winDuel(s, 'b', 2, rng);
    expect(s.seats.p1.coins).toBe(START_COINS);
    s = refAction(s, 'next', 3, rng);
    expect(s.phase).toBe('freeMenu');
  });
});
