import type { Outcome } from '../games/types';

export type SeatId = string;
export type Side = 'a' | 'b';
export type Mode = 'party' | 'free';

export interface AllTimeStats {
  gamesPlayed: number;
  gamesWon: number;
  duelWins: number;
  duelLosses: number;
  betsOn: number;
  betsAgainst: number;
  betsWon: number;
  betsLost: number;
  betNet: number;
}

export interface Profile {
  id: string;
  name: string;
  color: string;
  accessory: string;
  createdAt: number;
  stats: AllTimeStats;
}

export interface Look {
  name: string;
  color: string;
  accessory: string;
}

/** Stats for the current game only (used for the awards). */
export interface GameStats {
  betsOn: number;
  betsAgainst: number;
  duelWins: number;
  duelLosses: number;
  betCoinsWon: number;
  betsWon: number;
  betsLost: number;
  betNet: number;
  biggestLoss: number;
  streak: number;
  bestStreak: number;
  duels: number;
  refs: number;
}

export interface Seat extends Look {
  id: SeatId;
  profileId: string;
  coins: number;
  connected: boolean;
  joinedAt: number;
  /** Random tie-break order for fair selection, fixed when the player joins. */
  rank: number;
  gs: GameStats;
}

export interface Bet {
  on: Side;
  amount: number;
  auto: boolean;
}

export type DuelKind = 'round' | 'tiebreak' | 'final' | 'free';

export interface Duel {
  kind: DuelKind;
  a: SeatId;
  b: SeatId;
  ref: SeatId | null;
  gameId: string | null;
  game: any;
  winner: Outcome | null;
}

export type Phase =
  | 'lobby'
  | 'paused'
  | 'freeMenu'
  | 'pick'
  | 'spin'
  | 'bet'
  /** The game's instructions are on the big screen, waiting for the round's Host to start it. */
  | 'ready'
  | 'duel'
  | 'result'
  | 'end';

export interface Spin {
  gameId: string;
  options: string[];
  startedAt: number;
  turns: number;
}

export interface Finals {
  /** Players already through to the final. */
  locked: SeatId[];
  /** Players tied for the remaining spot(s), still in the tie-break. */
  pool: SeatId[];
  slots: number;
}

export interface Award {
  id: string;
  title: string;
  blurb: string;
  seats: SeatId[];
  value: number;
}

export interface RoundRecord {
  kind: DuelKind;
  a: SeatId;
  b: SeatId;
  ref: SeatId | null;
  gameId: string;
  winner: Side;
  bets: Record<SeatId, Bet>;
  delta: Record<SeatId, number>;
}

export interface EngineState {
  code: string;
  mode: Mode;
  totalRounds: number;
  roundsPlayed: number;
  phase: Phase;
  phaseStartedAt: number;
  phaseEndsAt: number | null;
  seats: Record<SeatId, Seat>;
  order: SeatId[];
  lastPair: SeatId[] | null;
  duel: Duel | null;
  bets: Record<SeatId, Bet>;
  gifted: SeatId[];
  spin: Spin | null;
  enabledGames: string[];
  finals: Finals | null;
  champion: SeatId | null;
  runnerUp: SeatId | null;
  awards: Award[];
  history: RoundRecord[];
  lastDelta: Record<SeatId, number> | null;
  rejects: Record<string, { msg: string; at: number }>;
  /** Free play: whether the host wants a wheel spin before the duel. */
  freeSpin: boolean;
  /** All-time stats for this game have been saved to the profiles. */
  statsSaved: boolean;
}

export type PlayerInput =
  | { t: 'bet'; on: Side; amount: number }
  | { t: 'game'; payload: any }
  | { t: 'ref'; action: RefAction }
  | { t: 'leave' };

export type RefAction = 'start' | 'next' | 'redo' | 'skipGame' | 'skipRound';

export interface PublicState {
  code: string;
  mode: Mode;
  totalRounds: number;
  roundsPlayed: number;
  phase: Phase;
  phaseStartedAt: number;
  phaseEndsAt: number | null;
  hostNow: number;
  seats: Record<SeatId, Omit<Seat, 'gs'> & { gs?: GameStats }>;
  order: SeatId[];
  duel: (Omit<Duel, 'game'> & { view: any }) | null;
  /** Who has locked in a bet; amounts only appear once the round is over. */
  betLocked: SeatId[];
  bets: Record<SeatId, Bet> | null;
  bettors: SeatId[];
  gifted: SeatId[];
  spin: Spin | null;
  enabledGames: string[];
  finals: Finals | null;
  champion: SeatId | null;
  runnerUp: SeatId | null;
  awards: Award[];
  lastDelta: Record<SeatId, number> | null;
  rejects: Record<string, { msg: string; at: number }>;
  profiles: Profile[];
  takenProfiles: string[];
  takenColors: string[];
}
