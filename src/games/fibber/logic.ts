import type { GameContext, GamePerson, MinigameLogic, Outcome } from '../types';
import { questionId } from '../trivia/bank';
import { drawFrom } from '../trivia/deck';
import file from './facts.txt?raw';

/** Name the used facts are remembered under in the host's account. */
export const DECK = 'fibber';
/** Time for the duelists to write their lies. */
export const WRITE_MS = 60_000;
/** Time for the audience to vote. */
export const VOTE_MS = 30_000;
/** Gap between each step of the reveal (each lie, then the truth). */
export const STEP_MS = 2_500;
/** How long the result stays on the big screen before the duel ends (or the next fact comes). */
export const RESULT_MS = 5_000;
export const MAX_LIE = 30;

export type Side = 'a' | 'b';
export const SIDES: Side[] = ['a', 'b'];

export interface Fact {
  id: string;
  /** The fact with `___` where the blank goes. */
  text: string;
  answer: string;
  /** Other ways of writing the true answer, so they count as "that's the truth". */
  alts: string[];
}

export const BLANK = '___';

/** Reads the facts file: `fact with ___ | answer | alt | alt`, `#` lines are notes. Repeats are skipped. */
export function parseFacts(text: string): Fact[] {
  const seen = new Set<string>();
  const out: Fact[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const [fact, answer, ...alts] = t.split('|').map((x) => x.trim());
    if (!fact || !answer || fact.split(BLANK).length !== 2) continue;
    const id = questionId(fact);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, text: fact, answer, alts: alts.filter(Boolean) });
  }
  return out;
}

export const FACTS = parseFacts(file);

/** A typed lie tidied up, or null if there's nothing left. */
export function cleanLie(text: unknown): string | null {
  const t = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LIE)
    .replace(/[.!?,;:]+$/, '')
    .trim();
  return t || null;
}

/**
 * The bare bones of an answer for comparing: case, accents, punctuation, a leading
 * "a/an/the" and a plural "s" don't count, so "The Unicorns!" is the same as "unicorn".
 */
export function answerKey(text: string): string {
  let t = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(a|an|the) /, '');
  t = t.replace(/ /g, '');
  return t.length > 3 ? t.replace(/(es|s)$/, '') : t;
}

/** Whether a lie is really just the true answer. */
export function isTruth(fact: Fact, lie: string) {
  const key = answerKey(lie);
  return [fact.answer, ...fact.alts].some((a) => answerKey(a) === key);
}

/** Someone who votes for the answer they think is true. */
export interface Voter extends GamePerson {
  host: boolean;
}

export interface Option {
  text: string;
  /** Whose lie it is, or 'truth'. */
  owner: Side | 'truth';
}

export interface FibberState {
  /**
   * writing: both duelists see the fact and write a lie to fill the blank.
   * voting: the Host and audience see the truth and both lies, shuffled, and pick the one they think is true.
   * reveal: the votes, then each lie, then the truth are shown one at a time.
   * replay: a draw (same number fooled, or nobody fooled), a new fact is coming.
   * result: someone fooled more people.
   */
  status: 'writing' | 'voting' | 'reveal' | 'replay' | 'result' | 'done';
  fact: Fact;
  /** Which fact of this duel this is (goes up on each replay). */
  number: number;
  voters: Voter[];
  writeUntil: number;
  lies: Partial<Record<Side, string>>;
  /** Why the last lie someone sent was turned away. */
  rejected: Partial<Record<Side, 'truth' | 'taken'>>;
  options: Option[];
  voteUntil: number | null;
  /** Voter id → option index. */
  votes: Record<string, number>;
  revealAt: number | null;
  fooled: Record<Side, number> | null;
  /** Set when someone didn't write a lie in time. */
  noLie: Side[];
  resultUntil: number | null;
  winner: Outcome | null;
}

export interface FibberView {
  status: FibberState['status'];
  fact: string;
  number: number;
  voters: Voter[];
  writeUntil: number;
  /** Who has written a lie. */
  written: Side[];
  rejected: Partial<Record<Side, 'truth' | 'taken'>>;
  /** Both lies, only for their own writer (filtered on the phone) and after writing. */
  lies: Partial<Record<Side, string>>;
  /** The three answers to pick from (no owners until the reveal). */
  options: { text: string; owner: Side | 'truth' | null }[];
  voteUntil: number | null;
  /** Who has voted. */
  voted: string[];
  /** Voter id → option index, only once revealed. */
  votes: Record<string, number> | null;
  revealAt: number | null;
  /** The true answer, only once revealed. */
  answer: string | null;
  fooled: Record<Side, number> | null;
  noLie: Side[];
  winner: Outcome | null;
}

/** How many reveal steps there are: the votes, each lie, then the truth. */
export const REVEAL_STEPS = 4;
export const REVEAL_MS = STEP_MS * REVEAL_STEPS;

/**
 * Which step of the reveal is showing: 0 = who voted for what, 1 and 2 = the lies in the order
 * they appear, 3 = the truth.
 */
export function revealStep(revealAt: number | null, now: number) {
  if (revealAt === null) return -1;
  return Math.min(REVEAL_STEPS - 1, Math.max(0, Math.floor((now - revealAt) / STEP_MS)));
}

/** The order the options are unmasked in: lies first (top to bottom), the truth last. */
export function unmaskOrder(options: { owner: Side | 'truth' | null }[]) {
  const lies = options.map((_, i) => i).filter((i) => options[i].owner !== 'truth');
  const truth = options.findIndex((o) => o.owner === 'truth');
  return [...lies, truth];
}

const NOBODY: GameContext = { ref: { id: 'ref', name: 'Host' }, audience: [] };

/** Everyone who isn't duelling votes: the Host first, then the audience. */
function votersOf(ctx: GameContext): Voter[] {
  return [...(ctx.ref ? [{ ...ctx.ref, host: true }] : []), ...ctx.audience.map((p) => ({ ...p, host: false }))];
}

function newFact(s: FibberState | null, ctx: GameContext, now: number, rng: () => number, number: number): FibberState {
  return {
    status: 'writing',
    fact: drawFrom(DECK, FACTS, rng, s?.fact.id),
    number,
    voters: s?.voters ?? votersOf(ctx),
    writeUntil: now + WRITE_MS,
    lies: {},
    rejected: {},
    options: [],
    voteUntil: null,
    votes: {},
    revealAt: null,
    fooled: null,
    noLie: [],
    resultUntil: null,
    winner: null,
  };
}

function shuffle<T>(list: T[], rng: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function startVoting(s: FibberState, now: number, rng: () => number): FibberState {
  const options: Option[] = shuffle(
    [
      { text: s.fact.answer, owner: 'truth' },
      { text: s.lies.a!, owner: 'a' },
      { text: s.lies.b!, owner: 'b' },
    ],
    rng,
  );
  return { ...s, status: 'voting', options, voteUntil: now + VOTE_MS };
}

const startReveal = (s: FibberState, now: number): FibberState => {
  const fooled = { a: 0, b: 0 };
  for (const pick of Object.values(s.votes)) {
    const owner = s.options[pick]?.owner;
    if (owner === 'a' || owner === 'b') fooled[owner]++;
  }
  return { ...s, status: 'reveal', revealAt: now, fooled };
};

/** After the reveal: more fooled wins, otherwise (including nobody fooled) it's a new fact. */
function finish(s: FibberState, now: number): FibberState {
  const { a, b } = s.fooled!;
  if (a === b) return { ...s, status: 'replay', resultUntil: now + RESULT_MS };
  return { ...s, status: 'result', winner: a > b ? 'a' : 'b', resultUntil: now + RESULT_MS };
}

/** Time to write ran out: whoever wrote a lie wins, and nobody writing means a new fact. */
function writingTimeUp(s: FibberState, now: number): FibberState {
  const noLie = SIDES.filter((side) => !s.lies[side]);
  if (noLie.length === 2) return { ...s, status: 'replay', noLie, resultUntil: now + RESULT_MS };
  return { ...s, status: 'result', noLie, winner: noLie[0] === 'a' ? 'b' : 'a', resultUntil: now + RESULT_MS };
}

export const fibberLogic: MinigameLogic<FibberState, FibberView> = {
  info: {
    id: 'fibber',
    name: 'Fibber',
    rules:
      'You both get the same strange-but-true fact with a blank. Write a believable lie to fill it. The audience sees the truth and both lies, and picks which one is real. Fool more people to win!',
    refereeDuty: 'Vote for the answer you think is true, just like the audience. You can swap the fact before the lies are in if someone already knows it.',
    icon: '🤥',
    color: '#ff9a3c',
    category: 'misc',
    scoring: 'auto',
  },
  init(now, rng, ctx) {
    return newFact(null, ctx ?? NOBODY, now, rng, 1);
  },
  onInput(s, role, payload, now, rng, seat) {
    const action = payload?.action;

    if (s.status === 'writing' && action === 'lie' && (role === 'a' || role === 'b')) {
      if (s.lies[role] || now >= s.writeUntil) return s;
      const lie = cleanLie(payload.text);
      if (!lie) return s;
      const other = s.lies[role === 'a' ? 'b' : 'a'];
      const why = isTruth(s.fact, lie) ? 'truth' : other && answerKey(other) === answerKey(lie) ? 'taken' : null;
      if (why) return { ...s, rejected: { ...s.rejected, [role]: why } };
      const next = { ...s, lies: { ...s.lies, [role]: lie }, rejected: { ...s.rejected, [role]: undefined } };
      return next.lies.a && next.lies.b ? startVoting(next, now, rng) : next;
    }

    if (s.status === 'voting' && action === 'vote') {
      const me = role === 'ref' ? s.voters.find((p) => p.host) : role === 'audience' ? s.voters.find((p) => !p.host && p.id === seat) : undefined;
      const pick = payload.pick;
      if (!me || me.id in s.votes || !Number.isInteger(pick) || pick < 0 || pick >= s.options.length) return s;
      const next = { ...s, votes: { ...s.votes, [me.id]: pick } };
      return s.voters.every((p) => p.id in next.votes) ? startReveal(next, now) : next;
    }

    if (role !== 'ref') return s;
    // Someone already knows this one: swap it before any lies are in.
    if (s.status === 'writing' && action === 'newFact' && !s.lies.a && !s.lies.b) return newFact(s, NOBODY, now, rng, s.number);
    // Someone left or is taking too long: go on with the votes that are in.
    if (s.status === 'voting' && action === 'skip' && Object.keys(s.votes).length > 0) return startReveal(s, now);
    return s;
  },
  tick(s, now, rng) {
    if (s.status === 'writing' && now >= s.writeUntil) return writingTimeUp(s, now);
    if (s.status === 'voting' && now >= s.voteUntil!) return startReveal(s, now);
    if (s.status === 'reveal' && now >= s.revealAt! + REVEAL_MS) return finish(s, now);
    if (s.status === 'replay' && now >= s.resultUntil!) return newFact(s, NOBODY, now, rng, s.number + 1);
    if (s.status === 'result' && now >= s.resultUntil!) return { ...s, status: 'done' };
    return s;
  },
  result(s) {
    return s.status === 'done' ? s.winner : null;
  },
  project(s) {
    const shown = s.status !== 'writing' && s.status !== 'voting';
    return {
      status: s.status,
      fact: s.fact.text,
      number: s.number,
      voters: s.voters,
      writeUntil: s.writeUntil,
      written: SIDES.filter((side) => s.lies[side]),
      rejected: s.rejected,
      // While writing, a lie stays secret from the other duelist (phones only show their own).
      lies: s.status === 'writing' ? {} : s.lies,
      options: s.options.map((o) => ({ text: o.text, owner: shown ? o.owner : null })),
      voteUntil: s.voteUntil,
      voted: Object.keys(s.votes),
      votes: shown ? s.votes : null,
      revealAt: s.revealAt,
      answer: shown ? s.fact.answer : null,
      fooled: s.fooled,
      noLie: s.noLie,
      winner: s.winner,
    };
  },
};
