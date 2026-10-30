import type { ComponentType } from 'react';

/** Who an input comes from inside a duel. 'audience' is anyone else in the room. */
export type Role = 'a' | 'b' | 'ref' | 'audience';
export type Outcome = 'a' | 'b' | 'draw';

/** Which group a game belongs to. The host turns whole categories on or off in setup. */
export type GameCategory = 'trivia' | 'word' | 'chance' | 'puzzle' | 'card' | 'physical' | 'misc';

export interface GameInfo {
  id: string;
  name: string;
  /** Short label for the wheel (defaults to name). */
  shortName?: string;
  /** One-line rules shown on the wheel reveal and phones. */
  rules: string;
  /** What the round's Host does in this game (shown on the Host's phone). */
  refereeDuty: string;
  icon: string;
  color: string;
  category: GameCategory;
  scoring: 'auto' | 'referee';
}

/** Someone in the room, as a game sees them. */
export interface GamePerson {
  id: string;
  name: string;
}

/** Who is in the room for this duel, for games that involve more than the two duelists. */
export interface GameContext {
  ref: GamePerson | null;
  /** Everyone else who is here: not a duelist and not the Host. */
  audience: GamePerson[];
}

/**
 * The game logic half of a minigame. Runs only on the host.
 * All functions are pure: they return a new state instead of mutating.
 */
export interface MinigameLogic<S = any, P = any> {
  info: GameInfo;
  init(now: number, rng: () => number, ctx?: GameContext): S;
  /** `seat` is who sent it, so games can tell audience members apart. */
  onInput(state: S, role: Role, payload: any, now: number, rng: () => number, seat?: string): S;
  tick?(state: S, now: number, rng: () => number): S;
  /** null while the game is still going. */
  result(state: S): Outcome | null;
  /** What everyone is allowed to see (hide secret picks etc). */
  project(state: S): P;
}

export interface DuelPeople {
  a: { name: string; color: string; accessory: string };
  b: { name: string; color: string; accessory: string };
  ref: { name: string; color: string; accessory: string } | null;
}

export interface ViewProps<P = any> {
  view: P;
  people: DuelPeople;
  /** Host clock estimate, for countdowns. */
  now: () => number;
}

export interface PhoneViewProps<P = any> extends ViewProps<P> {
  send: (payload: any) => void;
}

export interface DuelistViewProps<P = any> extends PhoneViewProps<P> {
  side: 'a' | 'b';
}

/** The React half of a minigame. */
export interface MinigameViews<P = any> {
  HostView: ComponentType<ViewProps<P>>;
  DuelistView: ComponentType<DuelistViewProps<P>>;
  RefereeView?: ComponentType<PhoneViewProps<P>>;
  /** Shown to everyone else's phone during the duel, for games the audience takes part in. */
  AudienceView?: ComponentType<PhoneViewProps<P> & { seat: string }>;
}
