import type { ComponentType } from 'react';

/** Who an input comes from inside a duel. */
export type Role = 'a' | 'b' | 'ref';
export type Outcome = 'a' | 'b' | 'draw';

export interface GameInfo {
  id: string;
  name: string;
  /** Short label for the wheel (defaults to name). */
  shortName?: string;
  /** One-line rules shown on the wheel reveal and phones. */
  rules: string;
  /** What the referee does in this game (shown on the referee's phone). */
  refereeDuty: string;
  icon: string;
  color: string;
  needsReferee: boolean;
  scoring: 'auto' | 'referee';
}

/**
 * The game logic half of a minigame. Runs only on the host.
 * All functions are pure: they return a new state instead of mutating.
 */
export interface MinigameLogic<S = any, P = any> {
  info: GameInfo;
  init(now: number, rng: () => number): S;
  onInput(state: S, role: Role, payload: any, now: number, rng: () => number): S;
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
}
