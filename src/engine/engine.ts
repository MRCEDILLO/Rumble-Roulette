import { GAME_LOGIC } from '../games/logic';
import type { Outcome } from '../games/types';
import type {
  AllTimeStats,
  Award,
  Bet,
  DuelKind,
  EngineState,
  GameStats,
  Look,
  Mode,
  PlayerInput,
  Profile,
  PublicState,
  RefAction,
  SeatId,
  Side,
} from './types';

export const START_COINS = 12;
export const MAX_BET = 3;
export const WIN_BONUS = 2;
export const MIN_PARTY_PLAYERS = 3;
export const MIN_FREE_PLAYERS = 2;
export const MAX_PLAYERS = 10;
export const PICK_MS = 4_500;
export const SPIN_MS = 5_500;
export const BET_MS = 15_000;

type Rng = () => number;

const clone = <T>(x: T): T => structuredClone(x);

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const pickRandom = <T>(items: T[], rng: Rng): T => items[Math.floor(rng() * items.length)];

export const emptyGameStats = (): GameStats => ({
  betsOn: 0,
  betsAgainst: 0,
  duelWins: 0,
  duelLosses: 0,
  betCoinsWon: 0,
  betsWon: 0,
  betsLost: 0,
  betNet: 0,
  biggestLoss: 0,
  streak: 0,
  bestStreak: 0,
  duels: 0,
  refs: 0,
});

export const emptyAllTimeStats = (): AllTimeStats => ({
  gamesPlayed: 0,
  gamesWon: 0,
  duelWins: 0,
  duelLosses: 0,
  betsOn: 0,
  betsAgainst: 0,
  betsWon: 0,
  betsLost: 0,
  betNet: 0,
});

export function createState(
  code: string,
  mode: Mode,
  totalRounds: number,
  enabledGames: string[],
  now: number,
): EngineState {
  return {
    code,
    mode,
    totalRounds,
    roundsPlayed: 0,
    phase: 'lobby',
    phaseStartedAt: now,
    phaseEndsAt: null,
    seats: {},
    order: [],
    lastPair: null,
    duel: null,
    bets: {},
    gifted: [],
    spin: null,
    enabledGames: enabledGames.filter((id) => GAME_LOGIC[id]),
    finals: null,
    champion: null,
    runnerUp: null,
    awards: [],
    history: [],
    lastDelta: null,
    rejects: {},
    freeSpin: true,
    statsSaved: false,
  };
}

/** Start a fresh game in the same room, keeping everyone who is seated. */
export function resetForNewGame(
  state: EngineState,
  mode: Mode,
  totalRounds: number,
  enabledGames: string[],
  now: number,
): EngineState {
  const s = createState(state.code, mode, totalRounds, enabledGames, now);
  for (const id of state.order) {
    s.seats[id] = { ...clone(state.seats[id]), coins: START_COINS, gs: emptyGameStats() };
    s.order.push(id);
  }
  return s;
}

function setPhase(s: EngineState, phase: EngineState['phase'], now: number, durationMs: number | null = null) {
  s.phase = phase;
  s.phaseStartedAt = now;
  s.phaseEndsAt = durationMs === null ? null : now + durationMs;
}

function reject(s: EngineState, uid: string, msg: string, now: number) {
  s.rejects[uid] = { msg, at: now };
}

/** Swap every reference to one seat id for another (used when a profile moves to a new phone). */
function rekeySeat(s: EngineState, from: SeatId, to: SeatId): EngineState {
  const json = JSON.stringify(s).split(JSON.stringify(from)).join(JSON.stringify(to));
  const next = JSON.parse(json) as EngineState;
  next.seats[to].id = to;
  return next;
}

// ---------------------------------------------------------------- seats

export function addSeat(
  state: EngineState,
  uid: SeatId,
  profileId: string,
  look: Look,
  now: number,
  rng: Rng,
): EngineState {
  let s = clone(state);
  if (s.seats[uid]) {
    s.seats[uid].connected = true;
    return s;
  }
  const holder = Object.values(s.seats).find((seat) => seat.profileId === profileId);
  if (holder) {
    if (holder.connected) {
      reject(s, uid, `${holder.name} is already playing on another phone.`, now);
      return s;
    }
    // Same profile coming back on a different phone: hand the seat over.
    s = rekeySeat(s, holder.id, uid);
    s.seats[uid].connected = true;
    delete s.rejects[uid];
    return s;
  }
  if (s.phase === 'end') {
    reject(s, uid, 'This game has finished. Wait for the host to start a new one.', now);
    return s;
  }
  if (s.order.length >= MAX_PLAYERS) {
    reject(s, uid, `The room is full (${MAX_PLAYERS} players).`, now);
    return s;
  }
  if (Object.values(s.seats).some((seat) => seat.color === look.color)) {
    reject(s, uid, 'Someone already has that colour. Pick another one.', now);
    return s;
  }
  const others = Object.values(s.seats);
  const gs = emptyGameStats();
  // Joining mid-game: count as having refereed as often as the least-used player so far.
  gs.refs = others.length ? Math.min(...others.map((seat) => seat.gs.refs)) : 0;
  gs.duels = others.length ? Math.min(...others.map((seat) => seat.gs.duels)) : 0;
  s.seats[uid] = {
    id: uid,
    profileId,
    ...look,
    coins: START_COINS,
    connected: true,
    joinedAt: now,
    rank: rng(),
    gs,
  };
  s.order.push(uid);
  delete s.rejects[uid];
  return s;
}

export function setConnected(state: EngineState, uid: SeatId, connected: boolean): EngineState {
  if (!state.seats[uid] || state.seats[uid].connected === connected) return state;
  const s = clone(state);
  s.seats[uid].connected = connected;
  return s;
}

export function removeSeat(state: EngineState, uid: SeatId, now: number, rng: Rng): EngineState {
  let s = clone(state);
  if (!s.seats[uid]) return s;
  const d = s.duel;
  const live = ['pick', 'spin', 'bet', 'duel', 'result'].includes(s.phase);
  const decided = s.phase === 'result' && d?.winner != null && d.winner !== 'draw';
  const leftMidDuel = !!d && live && !decided && (d.a === uid || d.b === uid);
  if (leftMidDuel && (d.kind === 'tiebreak' || d.kind === 'final')) {
    // A tie-break or final player left: the other player goes through.
    d.winner = d.a === uid ? 'b' : 'a';
    d.gameId = d.gameId ?? s.enabledGames[0];
    setPhase(s, 'result', now);
    s = payout(s);
  }
  delete s.seats[uid];
  delete s.bets[uid];
  s.order = s.order.filter((id) => id !== uid);
  s.gifted = s.gifted.filter((id) => id !== uid);
  if (s.finals) {
    s.finals.locked = s.finals.locked.filter((id) => id !== uid);
    s.finals.pool = s.finals.pool.filter((id) => id !== uid);
  }
  if (leftMidDuel && d.kind === 'round') return skipRound(s, now, rng);
  if (leftMidDuel && d.kind === 'free') {
    s.duel = null;
    setPhase(s, 'freeMenu', now);
    return s;
  }
  if (s.duel && live && s.duel.ref === uid) {
    s.duel.ref = chooseReferee(s, [s.duel.a, s.duel.b], rng);
  }
  return s;
}

// ---------------------------------------------------------------- selection

/**
 * Spread `slots` more turns over players so final totals are as even as possible
 * (lowest count first, ties broken by each player's fixed random rank).
 */
function waterFill(
  ids: SeatId[],
  count: (id: SeatId) => number,
  rank: (id: SeatId) => number,
  slots: number,
  cap: (id: SeatId) => number = () => Infinity,
) {
  const need: Record<SeatId, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  for (let i = 0; i < slots; i++) {
    let best: SeatId | null = null;
    for (const id of ids) {
      if (need[id] >= cap(id)) continue;
      const v = count(id) + need[id];
      const bv = best === null ? Infinity : count(best) + need[best];
      if (v < bv || (v === bv && rank(id) < rank(best!))) best = id;
    }
    if (best === null) break;
    need[best] += 1;
  }
  return need;
}

/**
 * Choose this round's duelists and referee at random, but only from choices that still let every
 * player finish with an even share of duels and referee turns. Nothing is planned ahead: each round
 * is a fresh random pick among the choices that keep things fair.
 */
export function chooseRoundPeople(s: EngineState, rng: Rng): { a: SeatId; b: SeatId; ref: SeatId } {
  const ids = s.order;
  const left = Math.max(1, s.totalRounds - s.roundsPlayed);
  const rank = (id: SeatId) => s.seats[id].rank;
  const duelNeed = waterFill(ids, (id) => s.seats[id].gs.duels, rank, 2 * left);
  // Nobody can referee in a round they duel in, so cap referee turns by the rounds left over.
  const refNeed = waterFill(ids, (id) => s.seats[id].gs.refs, rank, left, (id) => left - duelNeed[id]);

  type Pick = { a: SeatId; b: SeatId; ref: SeatId };
  const all: Pick[] = [];
  const fair: Pick[] = [];
  for (const ref of ids) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i];
        const b = ids[j];
        if (a === ref || b === ref) continue;
        const pick = { a, b, ref };
        all.push(pick);
        if (!duelNeed[a] || !duelNeed[b] || !refNeed[ref]) continue;
        // After this round, nobody may need more turns than rounds remain.
        const ok = ids.every((id) => {
          const d = duelNeed[id] - (id === a || id === b ? 1 : 0);
          const r = refNeed[id] - (id === ref ? 1 : 0);
          return d + r <= left - 1 || left - 1 <= 0;
        });
        if (ok) fair.push(pick);
      }
    }
  }
  let options = fair.length ? fair : all;
  // Avoid the exact same pair as last round when there's another option.
  const last = s.lastPair;
  const fresh = options.filter((p) => !(last && last.includes(p.a) && last.includes(p.b)));
  if (fresh.length) options = fresh;
  const pick = pickRandom(options, rng);
  return Math.floor(rng() * 2) ? pick : { a: pick.b, b: pick.a, ref: pick.ref };
}

/** Referee for a tie-break or final: whoever has refereed least. */
export function chooseReferee(s: EngineState, exclude: SeatId[], rng: Rng): SeatId | null {
  const candidates = s.order.filter((id) => !exclude.includes(id));
  if (!candidates.length) return null;
  const least = Math.min(...candidates.map((id) => s.seats[id].gs.refs));
  return pickRandom(
    candidates.filter((id) => s.seats[id].gs.refs === least),
    rng,
  );
}

// ---------------------------------------------------------------- flow

export function startGame(state: EngineState, now: number, rng: Rng): EngineState {
  const s = clone(state);
  if (s.phase !== 'lobby') return s;
  if (s.mode === 'free') {
    if (s.order.length < MIN_FREE_PLAYERS) return s;
    setPhase(s, 'freeMenu', now);
    return s;
  }
  if (s.order.length < MIN_PARTY_PLAYERS) return s;
  return beginRound(s, now, rng);
}

function beginRound(s: EngineState, now: number, rng: Rng): EngineState {
  s.bets = {};
  s.spin = null;
  s.lastDelta = null;
  s.gifted = [];
  if (s.order.length < MIN_PARTY_PLAYERS) {
    s.duel = null;
    setPhase(s, 'paused', now);
    return s;
  }
  const { a, b, ref } = chooseRoundPeople(s, rng);
  s.seats[a].gs.duels += 1;
  s.seats[b].gs.duels += 1;
  s.seats[ref].gs.refs += 1;
  for (const id of s.order) {
    if (id !== a && id !== b && s.seats[id].coins === 0) {
      s.seats[id].coins = 1;
      s.gifted.push(id);
    }
  }
  s.duel = { kind: 'round', a, b, ref, gameId: null, game: null, winner: null };
  setPhase(s, 'pick', now, PICK_MS);
  return s;
}

function gameOptions(s: EngineState, hasRef: boolean): string[] {
  const enabled = s.enabledGames.filter((id) => GAME_LOGIC[id]);
  const usable = hasRef ? enabled : enabled.filter((id) => !GAME_LOGIC[id].info.needsReferee);
  return usable;
}

function startSpin(s: EngineState, now: number, rng: Rng, exclude: string | null = null): EngineState {
  const d = s.duel!;
  const hasRef = d.ref !== null || (d.kind === 'free' && s.order.length > 2);
  const options = gameOptions(s, hasRef);
  if (!options.length) return s;
  const fresh = options.filter((id) => id !== exclude);
  const gameId = pickRandom(fresh.length ? fresh : options, rng);
  if (d.kind === 'free' && GAME_LOGIC[gameId].info.needsReferee && !d.ref) {
    d.ref = pickRandom(
      s.order.filter((id) => id !== d.a && id !== d.b),
      rng,
    );
  }
  d.gameId = gameId;
  d.game = null;
  d.winner = null;
  s.spin = { gameId, options, startedAt: now, turns: 4 + Math.floor(rng() * 3) };
  setPhase(s, 'spin', now, SPIN_MS);
  return s;
}

function startDuelGame(s: EngineState, now: number, rng: Rng): EngineState {
  const d = s.duel!;
  d.game = GAME_LOGIC[d.gameId!].init(now, rng);
  d.winner = null;
  setPhase(s, 'duel', now);
  return s;
}

export function bettors(s: EngineState): SeatId[] {
  if (s.duel?.kind !== 'round') return [];
  return s.order.filter((id) => id !== s.duel!.a && id !== s.duel!.b);
}

function maxBet(coins: number) {
  return Math.min(MAX_BET, coins);
}

function fillAutoBets(s: EngineState, rng: Rng) {
  for (const id of bettors(s)) {
    if (!s.bets[id] && s.seats[id].coins > 0) {
      s.bets[id] = { on: rng() < 0.5 ? 'a' : 'b', amount: 1, auto: true };
    }
  }
}

function checkResult(s: EngineState, now: number): EngineState {
  const d = s.duel!;
  const outcome = GAME_LOGIC[d.gameId!].result(d.game);
  if (outcome === null) return s;
  d.winner = outcome;
  setPhase(s, 'result', now);
  return outcome === 'draw' ? s : payout(s);
}

function payout(s: EngineState): EngineState {
  const d = s.duel!;
  const side = d.winner as Side;
  const winner = d[side];
  const loser = side === 'a' ? d.b : d.a;
  const delta: Record<SeatId, number> = {};
  const counted = d.kind !== 'free';

  if (counted) {
    const w = s.seats[winner]?.gs;
    if (w) {
      w.duelWins += 1;
      w.streak += 1;
      w.bestStreak = Math.max(w.bestStreak, w.streak);
    }
    const l = s.seats[loser]?.gs;
    if (l) {
      l.duelLosses += 1;
      l.streak = 0;
    }
  }

  if (d.kind === 'round') {
    if (s.seats[winner]) {
      s.seats[winner].coins += WIN_BONUS;
      delta[winner] = WIN_BONUS;
    }
    for (const [id, bet] of Object.entries(s.bets)) {
      const seat = s.seats[id];
      if (!seat) continue;
      const target = d[bet.on];
      const other = bet.on === 'a' ? d.b : d.a;
      if (s.seats[target]) s.seats[target].gs.betsOn += 1;
      if (s.seats[other]) s.seats[other].gs.betsAgainst += 1;
      if (bet.on === side) {
        seat.coins += bet.amount;
        seat.gs.betCoinsWon += bet.amount;
        seat.gs.betsWon += 1;
        seat.gs.betNet += bet.amount;
        delta[id] = bet.amount;
      } else {
        seat.coins = Math.max(0, seat.coins - bet.amount);
        seat.gs.betsLost += 1;
        seat.gs.betNet -= bet.amount;
        seat.gs.biggestLoss = Math.max(seat.gs.biggestLoss, bet.amount);
        delta[id] = -bet.amount;
      }
    }
    s.roundsPlayed += 1;
    s.lastPair = [d.a, d.b];
  }

  s.history.push({
    kind: d.kind,
    a: d.a,
    b: d.b,
    ref: d.ref,
    gameId: d.gameId!,
    winner: side,
    bets: clone(s.bets),
    delta,
  });
  s.lastDelta = delta;
  return s;
}

function skipRound(s: EngineState, now: number, rng: Rng): EngineState {
  const d = s.duel;
  if (!d || d.kind !== 'round') return s;
  for (const id of s.gifted) if (s.seats[id]) s.seats[id].coins = Math.max(0, s.seats[id].coins - 1);
  // Hand back the turns so the skipped round doesn't count against anyone.
  for (const id of [d.a, d.b]) if (s.seats[id]) s.seats[id].gs.duels = Math.max(0, s.seats[id].gs.duels - 1);
  if (d.ref && s.seats[d.ref]) s.seats[d.ref].gs.refs = Math.max(0, s.seats[d.ref].gs.refs - 1);
  s.duel = null;
  return beginRound(s, now, rng);
}

// ---------------------------------------------------------------- finals

function beginFinals(s: EngineState, now: number, rng: Rng): EngineState {
  s.bets = {};
  s.gifted = [];
  s.lastDelta = null;
  const sorted = [...s.order].sort((x, y) => s.seats[y].coins - s.seats[x].coins);
  if (sorted.length < 2) return finish(s, sorted[0] ?? null, null, now);
  const cut = s.seats[sorted[1]].coins;
  const locked = sorted.filter((id) => s.seats[id].coins > cut);
  const pool = sorted.filter((id) => s.seats[id].coins === cut);
  s.finals = { locked, pool, slots: 2 - locked.length };
  return continueFinals(s, now, rng);
}

function continueFinals(s: EngineState, now: number, rng: Rng): EngineState {
  const f = s.finals!;
  if (f.pool.length > f.slots) {
    const [a, b] = shuffle(f.pool, rng);
    return startSpecialDuel(s, 'tiebreak', a, b, now, rng);
  }
  const finalists = [...f.locked, ...f.pool];
  if (finalists.length < 2) return finish(s, finalists[0] ?? null, null, now);
  const [a, b] = shuffle(finalists, rng);
  return startSpecialDuel(s, 'final', a, b, now, rng);
}

function startSpecialDuel(s: EngineState, kind: DuelKind, a: SeatId, b: SeatId, now: number, rng: Rng) {
  s.bets = {};
  s.spin = null;
  const ref = chooseReferee(s, [a, b], rng);
  s.duel = { kind, a, b, ref, gameId: null, game: null, winner: null };
  setPhase(s, 'pick', now, PICK_MS);
  return s;
}

function finish(s: EngineState, champion: SeatId | null, runnerUp: SeatId | null, now: number): EngineState {
  s.champion = champion;
  s.runnerUp = runnerUp;
  s.awards = computeAwards(s);
  s.duel = null;
  s.spin = null;
  setPhase(s, 'end', now);
  return s;
}

export function computeAwards(s: EngineState): Award[] {
  const defs: { id: string; title: string; blurb: string; get: (g: GameStats) => number }[] = [
    { id: 'favourite', title: 'Crowd Favourite', blurb: 'Most bets placed on them', get: (g) => g.betsOn },
    { id: 'enemy', title: 'Public Enemy', blurb: 'Most bets placed against them', get: (g) => g.betsAgainst },
    { id: 'master', title: 'Duel Master', blurb: 'Most duel wins', get: (g) => g.duelWins },
    { id: 'bettor', title: 'Best Bettor', blurb: 'Most coins won from bets', get: (g) => g.betCoinsWon },
    { id: 'ouch', title: 'Ouch', blurb: 'Biggest coin loss in one round', get: (g) => g.biggestLoss },
    { id: 'fire', title: 'On Fire', blurb: 'Longest duel win streak', get: (g) => g.bestStreak },
  ];
  const awards: Award[] = [];
  for (const def of defs) {
    const best = Math.max(0, ...s.order.map((id) => def.get(s.seats[id].gs)));
    if (best <= 0) continue;
    awards.push({
      id: def.id,
      title: def.title,
      blurb: def.blurb,
      value: best,
      seats: s.order.filter((id) => def.get(s.seats[id].gs) === best),
    });
  }
  return awards;
}

/** Increments to apply to each profile's all-time stats when a party game ends. */
export function allTimeDeltas(s: EngineState): Record<string, AllTimeStats> {
  const out: Record<string, AllTimeStats> = {};
  for (const id of s.order) {
    const seat = s.seats[id];
    const g = seat.gs;
    out[seat.profileId] = {
      gamesPlayed: 1,
      gamesWon: s.champion === id ? 1 : 0,
      duelWins: g.duelWins,
      duelLosses: g.duelLosses,
      betsOn: g.betsOn,
      betsAgainst: g.betsAgainst,
      betsWon: g.betsWon,
      betsLost: g.betsLost,
      betNet: g.betNet,
    };
  }
  return out;
}

// ---------------------------------------------------------------- inputs

export function tick(state: EngineState, now: number, rng: Rng): EngineState {
  const ends = state.phaseEndsAt;
  const due = ends !== null && now >= ends;
  if (state.phase === 'duel') {
    const logic = GAME_LOGIC[state.duel!.gameId!];
    if (!logic.tick) return state;
    const game = logic.tick(state.duel!.game, now, rng);
    if (game === state.duel!.game) return state;
    const s = clone(state);
    s.duel!.game = game;
    return checkResult(s, now);
  }
  if (!due) return state;
  const s = clone(state);
  switch (s.phase) {
    case 'pick':
      return startSpin(s, now, rng);
    case 'spin':
      if (s.duel!.kind === 'round') {
        setPhase(s, 'bet', now, BET_MS);
        return s;
      }
      return startDuelGame(s, now, rng);
    case 'bet':
      fillAutoBets(s, rng);
      return startDuelGame(s, now, rng);
    default:
      return state;
  }
}

export function applyInput(state: EngineState, uid: SeatId, input: PlayerInput, now: number, rng: Rng): EngineState {
  if (input.t === 'leave') return removeSeat(state, uid, now, rng);
  if (!state.seats[uid]) return state;
  const d = state.duel;
  switch (input.t) {
    case 'bet': {
      if (state.phase !== 'bet' || state.bets[uid] || !bettors(state).includes(uid)) return state;
      const amount = Math.floor(Number(input.amount));
      if ((input.on !== 'a' && input.on !== 'b') || amount < 1 || amount > maxBet(state.seats[uid].coins)) {
        return state;
      }
      const s = clone(state);
      s.bets[uid] = { on: input.on, amount, auto: false } satisfies Bet;
      const allIn = bettors(s).every((id) => s.bets[id] || s.seats[id].coins === 0);
      return allIn ? startDuelGame(s, now, rng) : s;
    }
    case 'game': {
      if (state.phase !== 'duel' || !d) return state;
      const role = uid === d.a ? 'a' : uid === d.b ? 'b' : uid === d.ref ? 'ref' : null;
      if (!role) return state;
      const game = GAME_LOGIC[d.gameId!].onInput(d.game, role, input.payload, now, rng);
      if (game === d.game) return state;
      const s = clone(state);
      s.duel!.game = game;
      return checkResult(s, now);
    }
    case 'ref':
      if (!d || d.ref !== uid) return state;
      return refAction(state, input.action, now, rng);
  }
  return state;
}

/** What the referee's (or the host's) control buttons can do right now. */
export function allowedActions(s: EngineState | PublicState): RefAction[] {
  const d = s.duel;
  if (!d) return [];
  const isDraw = s.phase === 'result' && d.winner === 'draw';
  const decided = s.phase === 'result' && d.winner !== null && d.winner !== 'draw';
  const out: RefAction[] = [];
  if (decided) out.push('next');
  if (s.phase === 'duel' || isDraw) out.push('redo');
  if (s.phase === 'bet' || s.phase === 'duel' || isDraw) {
    const hasOtherGame = s.enabledGames.length > 1;
    if (hasOtherGame || d.kind === 'free') out.push('skipGame');
  }
  if ((d.kind === 'round' || d.kind === 'free') && !decided) out.push('skipRound');
  return out;
}

export function refAction(state: EngineState, action: RefAction, now: number, rng: Rng): EngineState {
  if (!allowedActions(state).includes(action)) return state;
  const s = clone(state);
  const d = s.duel!;
  switch (action) {
    case 'next':
      return advance(s, now, rng);
    case 'redo':
      return startDuelGame(s, now, rng);
    case 'skipGame':
      s.bets = {};
      return startSpin(s, now, rng, d.gameId);
    case 'skipRound':
      if (d.kind === 'free') {
        s.duel = null;
        setPhase(s, 'freeMenu', now);
        return s;
      }
      return skipRound(s, now, rng);
  }
}

function advance(s: EngineState, now: number, rng: Rng): EngineState {
  const d = s.duel!;
  const side = d.winner as Side;
  const winner = d[side];
  const loser = side === 'a' ? d.b : d.a;
  switch (d.kind) {
    case 'round':
      return s.roundsPlayed >= s.totalRounds ? beginFinals(s, now, rng) : beginRound(s, now, rng);
    case 'tiebreak':
      s.finals!.pool = s.finals!.pool.filter((id) => id !== loser);
      return continueFinals(s, now, rng);
    case 'final':
      return finish(s, winner, loser, now);
    case 'free':
      s.duel = null;
      s.lastDelta = null;
      setPhase(s, 'freeMenu', now);
      return s;
  }
}

// ---------------------------------------------------------------- host-only actions

export function hostContinue(state: EngineState, now: number, rng: Rng): EngineState {
  if (state.phase !== 'paused') return state;
  return beginRound(clone(state), now, rng);
}

/** Jump straight to the final (handy for testing and short on time). */
export function hostEndRounds(state: EngineState, now: number, rng: Rng): EngineState {
  if (state.mode !== 'party' || state.finals || state.phase === 'lobby' || state.phase === 'end') return state;
  const s = clone(state);
  if (s.duel?.kind === 'round' && !(s.phase === 'result' && s.duel.winner && s.duel.winner !== 'draw')) {
    for (const id of s.gifted) if (s.seats[id]) s.seats[id].coins = Math.max(0, s.seats[id].coins - 1);
  }
  s.duel = null;
  return beginFinals(s, now, rng);
}

export interface FreeStartOptions {
  gameId: string | null;
  a: SeatId | null;
  b: SeatId | null;
  ref: SeatId | null;
  spin: boolean;
}

export function hostFreeStart(state: EngineState, opts: FreeStartOptions, now: number, rng: Rng): EngineState {
  if (state.phase !== 'freeMenu' || state.order.length < MIN_FREE_PLAYERS) return state;
  const s = clone(state);
  const pool = shuffle(s.order, rng);
  const a = opts.a && s.seats[opts.a] ? opts.a : pool.find((id) => id !== opts.b)!;
  const b = opts.b && s.seats[opts.b] && opts.b !== a ? opts.b : pool.find((id) => id !== a)!;
  let ref = opts.ref && s.seats[opts.ref] && opts.ref !== a && opts.ref !== b ? opts.ref : null;
  s.bets = {};
  s.lastDelta = null;
  s.duel = { kind: 'free', a, b, ref, gameId: null, game: null, winner: null };
  if (opts.spin || !opts.gameId || !GAME_LOGIC[opts.gameId]) return startSpin(s, now, rng);
  const info = GAME_LOGIC[opts.gameId].info;
  if (info.needsReferee && !ref) {
    const others = s.order.filter((id) => id !== a && id !== b);
    if (!others.length) return state;
    ref = pickRandom(others, rng);
    s.duel.ref = ref;
  }
  s.duel.gameId = opts.gameId;
  return startDuelGame(s, now, rng);
}

// ---------------------------------------------------------------- projection

export function project(s: EngineState, profiles: Profile[], now: number): PublicState {
  const d = s.duel;
  const decided = d && s.phase === 'result' && d.winner !== null && d.winner !== 'draw';
  return {
    code: s.code,
    mode: s.mode,
    totalRounds: s.totalRounds,
    roundsPlayed: s.roundsPlayed,
    phase: s.phase,
    phaseStartedAt: s.phaseStartedAt,
    phaseEndsAt: s.phaseEndsAt,
    hostNow: now,
    seats: s.seats,
    order: s.order,
    duel: d
      ? {
          kind: d.kind,
          a: d.a,
          b: d.b,
          ref: d.ref,
          gameId: d.gameId,
          winner: d.winner,
          view: d.game && d.gameId ? GAME_LOGIC[d.gameId].project(d.game) : null,
        }
      : null,
    betLocked: Object.keys(s.bets),
    bets: decided ? s.bets : null,
    bettors: bettors(s),
    gifted: s.gifted,
    spin: s.spin,
    enabledGames: s.enabledGames,
    finals: s.finals,
    champion: s.champion,
    runnerUp: s.runnerUp,
    awards: s.awards,
    lastDelta: s.lastDelta,
    rejects: s.rejects,
    profiles,
    takenProfiles: Object.values(s.seats).map((seat) => seat.profileId),
    takenColors: Object.values(s.seats).map((seat) => seat.color),
  };
}

export type { Outcome };
