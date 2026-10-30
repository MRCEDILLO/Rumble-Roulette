import { ACCESSORIES, COLORS } from '../../characters/looks';
import type { MinigameLogic } from '../types';

type Side = 'a' | 'b';

/**
 * 9×8 = 72 Screenbots. Every phone and the big screen show the same crowd in the same spots, so it is a
 * fair race; 72 keeps each one big enough to tap on a phone while still being a proper crowd.
 */
export const COLS = 9;
export const ROWS = 8;
export const CROWD = COLS * ROWS;
/** At least this many decoys share the wanted colour, and this many share the hat, so it's never a giveaway. */
export const NEAR_MISSES = 6;

/** Best of 3: first to this many finds wins the duel. */
export const WINS_NEEDED = 2;
export const TIME_MS = 60_000;
/** A wrong tap freezes that phone for a moment, so mashing the crowd doesn't pay. */
export const LOCKOUT_MS = 3_000;
/** How long the found one stays lit up between rounds, and after the last round. */
export const ROUND_REVEAL_MS = 4_000;
export const REVEAL_MS = 6_000;

export const SCENES = ['city', 'beach', 'park', 'snow'] as const;
export type Scene = (typeof SCENES)[number];
export const SCENE_NAME: Record<Scene, string> = { city: 'Downtown', beach: 'The Beach', park: 'The Park', snow: 'Ski Slope' };

export interface Look {
  color: string;
  accessory: string;
}

export interface Person extends Look {
  /** Top-left corner, as a fraction of the crowd area (0 to 1). */
  x: number;
  y: number;
  flip: boolean;
}

export interface WantedState {
  /** 'found' is the pause after each round, lit up on whoever found them (or nobody, when time ran out). */
  status: 'playing' | 'found' | 'done';
  round: number;
  wins: Record<Side, number>;
  /** Who found them last round, or null if time ran out. */
  roundWinner: Side | null;
  scene: Scene;
  wanted: Look;
  /** Back to front: later people stand in front of earlier ones. */
  crowd: Person[];
  /** Where the wanted one is in the crowd. Never sent to phones until the reveal. */
  target: number;
  endsAt: number;
  lockedUntil: Record<Side, number>;
  /** Who each duelist tapped by mistake, so their phone can cross them out. */
  misses: Record<Side, number[]>;
  revealUntil: number | null;
  /** Set once someone has won the duel. */
  winner: Side | null;
}

export interface WantedView {
  status: WantedState['status'];
  round: number;
  wins: Record<Side, number>;
  roundWinner: Side | null;
  scene: Scene;
  wanted: Look;
  crowd: Person[];
  /** null while the round is on. */
  target: number | null;
  endsAt: number;
  lockedUntil: Record<Side, number>;
  misses: Record<Side, number[]>;
  winner: Side | null;
}

export const otherSide = (s: Side): Side => (s === 'a' ? 'b' : 'a');

const pick = <T>(list: readonly T[], rng: () => number) => list[Math.floor(rng() * list.length)];

const same = (p: Look, q: Look) => p.color === q.color && p.accessory === q.accessory;

/** Everyone but the wanted one: a few near misses, then anyone at all who isn't the wanted look. */
export function makeDecoys(wanted: Look, count: number, rng: () => number): Look[] {
  const colors = COLORS.map((c) => c.id);
  const hats: string[] = ACCESSORIES.map((a) => a.id);
  const out: Look[] = [];
  for (let i = 0; i < NEAR_MISSES; i++) {
    out.push({ color: wanted.color, accessory: pick(hats.filter((h) => h !== wanted.accessory), rng) });
    out.push({ color: pick(colors.filter((c) => c !== wanted.color), rng), accessory: wanted.accessory });
  }
  while (out.length < count) {
    const look = { color: pick(colors, rng), accessory: pick(hats, rng) };
    if (!same(look, wanted)) out.push(look);
  }
  return out.slice(0, count);
}

function shuffle<T>(list: T[], rng: () => number) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A loose grid with a little wobble, so it reads as a crowd but nobody is ever fully hidden. */
function place(looks: Look[], rng: () => number): Person[] {
  return looks.map((look, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    return {
      ...look,
      x: (col + 0.05 + (rng() - 0.5) * 0.3) / COLS,
      y: (row + (rng() - 0.5) * 0.25) / ROWS,
      flip: rng() < 0.5,
    };
  });
}

/** A fresh poster, crowd and scene for the next round. Freezes and crossed-out people reset too. */
function newRound(now: number, rng: () => number) {
  const wanted = { color: pick(COLORS, rng).id, accessory: pick(ACCESSORIES, rng).id };
  const looks = shuffle([wanted, ...makeDecoys(wanted, CROWD - 1, rng)], rng);
  const crowd = place(looks, rng);
  return {
    status: 'playing' as const,
    scene: pick(SCENES, rng),
    wanted,
    crowd,
    target: crowd.findIndex((p) => same(p, wanted)),
    endsAt: now + TIME_MS,
    lockedUntil: { a: 0, b: 0 },
    misses: { a: [], b: [] },
    revealUntil: null,
  };
}

export const wantedLogic: MinigameLogic<WantedState, WantedView> = {
  info: {
    id: 'wanted',
    name: 'WANTED',
    rules: `Best of 3! Find the Screenbot on the WANTED poster in a crowd of ${CROWD}. Only one has that exact colour and hat. First to tap them on their phone gets the round, but a wrong tap freezes you for ${LOCKOUT_MS / 1000} seconds. First to ${WINS_NEEDED} wins.`,
    refereeDuty: 'Nothing to judge: the game scores itself. Keep the crowd from shouting where they are!',
    icon: '🤠',
    color: '#c8742c',
    category: 'puzzle',
    scoring: 'auto',
  },
  init(now, rng) {
    return { ...newRound(now, rng), round: 1, wins: { a: 0, b: 0 }, roundWinner: null, winner: null };
  },
  onInput(s, role, payload, now) {
    if (s.status !== 'playing' || (role !== 'a' && role !== 'b') || payload?.action !== 'tap') return s;
    const who = Number(payload.person);
    if (!Number.isInteger(who) || who < 0 || who >= s.crowd.length) return s;
    if (now < s.lockedUntil[role] || s.misses[role].includes(who)) return s;
    if (who === s.target) {
      const wins = { ...s.wins, [role]: s.wins[role] + 1 };
      const over = wins[role] >= WINS_NEEDED;
      return {
        ...s,
        status: 'found',
        wins,
        roundWinner: role,
        winner: over ? role : null,
        revealUntil: now + (over ? REVEAL_MS : ROUND_REVEAL_MS),
      };
    }
    return {
      ...s,
      lockedUntil: { ...s.lockedUntil, [role]: now + LOCKOUT_MS },
      misses: { ...s.misses, [role]: [...s.misses[role], who] },
    };
  },
  tick(s, now, rng) {
    // Nobody found them in time: no point to anyone, and the round is played again with a new crowd.
    if (s.status === 'playing' && now >= s.endsAt) return { ...s, status: 'found', roundWinner: null, revealUntil: now + ROUND_REVEAL_MS };
    if (s.status === 'found' && s.revealUntil !== null && now >= s.revealUntil) {
      if (s.winner) return { ...s, status: 'done' };
      return { ...s, ...newRound(now, rng), round: s.roundWinner ? s.round + 1 : s.round, roundWinner: null };
    }
    return s;
  },
  result(s) {
    return s.status === 'done' ? s.winner : null;
  },
  project(s) {
    const shown = s.status !== 'playing';
    return {
      status: s.status,
      round: s.round,
      wins: s.wins,
      roundWinner: s.roundWinner,
      scene: s.scene,
      wanted: s.wanted,
      crowd: s.crowd,
      target: shown ? s.target : null,
      endsAt: s.endsAt,
      lockedUntil: s.lockedUntil,
      misses: s.misses,
      winner: s.winner,
    };
  },
};
