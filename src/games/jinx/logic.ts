import type { GameContext, GamePerson, MinigameLogic, Outcome } from '../types';
import { questionId } from '../trivia/bank';
import { drawFrom } from '../trivia/deck';
import file from './prompts.txt?raw';

/** Name the used prompts are remembered under in the host's account. */
export const DECK = 'jinx';
/** Time for the duelists to think once they see the prompt, before they say their answers together. */
export const THINK_MS = 5_000;
/** How long the result stays on the big screen before the duel ends. */
export const RESULT_MS = 5_000;
export const MAX_ANSWER = 30;

export type Side = 'a' | 'b';
export const SIDES: Side[] = ['a', 'b'];

export interface Prompt {
  id: string;
  text: string;
}

/** Reads the prompt file: one prompt per line, `#` lines are notes. Repeats are skipped. */
export function parsePrompts(text: string): Prompt[] {
  const seen = new Set<string>();
  const out: Prompt[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const id = questionId(t);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, text: t });
  }
  return out;
}

export const PROMPTS = parsePrompts(file);

/** Someone who writes answers for the duelists to avoid. */
export interface Answerer extends GamePerson {
  host: boolean;
}

/**
 * How many answers each person writes. With a small room there'd be only one or two answers to
 * dodge, so nearly every round would be a "nobody matched" replay. Each person writes more instead,
 * so there are always at least 3 answers on the board.
 */
export function answersEach(people: number) {
  return people <= 1 ? 3 : people === 2 ? 2 : 1;
}

/** A typed answer tidied up, or null if there's nothing left. */
export function cleanAnswer(text: unknown): string | null {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_ANSWER).trim();
  return t || null;
}

export interface JinxState {
  /**
   * writing: the Host and audience type their answers (the duelists don't see the prompt yet).
   * saying: the duelists see the prompt and say their answer out loud.
   * reveal: everyone's answers are on the big screen, the Host marks who matched.
   * replay: both or neither matched, a new prompt is coming. result: one matched, the other wins.
   */
  status: 'writing' | 'saying' | 'reveal' | 'replay' | 'result' | 'done';
  prompt: Prompt;
  /** Which prompt of this duel this is (goes up on each replay). */
  number: number;
  answerers: Answerer[];
  each: number;
  answers: Record<string, string[]>;
  /** When the duelists should say their answers (host clock). */
  sayAt: number | null;
  matched: Record<Side, boolean> | null;
  resultUntil: number | null;
  winner: Outcome | null;
}

export interface JinxView {
  status: JinxState['status'];
  prompt: string;
  number: number;
  answerers: Answerer[];
  each: number;
  /** Who has sent their answers. */
  done: string[];
  /** Everyone's answers, only once they're revealed. */
  answers: Record<string, string[]> | null;
  sayAt: number | null;
  matched: Record<Side, boolean> | null;
  winner: Outcome | null;
}

const NOBODY: GameContext = { ref: { id: 'ref', name: 'Host' }, audience: [] };

/** Everyone who isn't duelling writes answers: the Host first, then the audience. */
function answerersOf(ctx: GameContext): Answerer[] {
  return [...(ctx.ref ? [{ ...ctx.ref, host: true }] : []), ...ctx.audience.map((p) => ({ ...p, host: false }))];
}

function newPrompt(s: Pick<JinxState, 'answerers' | 'each' | 'prompt'> | null, ctx: GameContext, rng: () => number, number: number): JinxState {
  const answerers = s?.answerers ?? answerersOf(ctx);
  return {
    status: 'writing',
    prompt: drawFrom(DECK, PROMPTS, rng, s?.prompt.id),
    number,
    answerers,
    each: s?.each ?? answersEach(answerers.length),
    answers: {},
    sayAt: null,
    matched: null,
    resultUntil: null,
    winner: null,
  };
}

const startSaying = (s: JinxState, now: number): JinxState => ({ ...s, status: 'saying', sayAt: now + THINK_MS });

export const jinxLogic: MinigameLogic<JinxState, JinxView> = {
  info: {
    id: 'jinx',
    name: 'Jinx!',
    rules:
      'The audience secretly answers a “Name a…” question. Then you both get it and say an answer out loud. Say the same as anyone in the audience and you’re jinxed!',
    refereeDuty:
      'Type your answers, then reveal everyone’s once both players have said theirs out loud. Mark who said the same as the audience.',
    icon: '🤐',
    color: '#9be15d',
    category: 'misc',
    scoring: 'referee',
  },
  init(_now, rng, ctx) {
    return newPrompt(null, ctx ?? NOBODY, rng, 1);
  },
  onInput(s, role, payload, now, rng, seat) {
    const action = payload?.action;

    if (s.status === 'writing' && action === 'answers') {
      const me = role === 'ref' ? s.answerers.find((p) => p.host) : role === 'audience' ? s.answerers.find((p) => !p.host && p.id === seat) : undefined;
      if (!me || s.answers[me.id] || !Array.isArray(payload.answers)) return s;
      const list = payload.answers.map(cleanAnswer);
      if (list.length !== s.each || list.some((a: string | null) => !a)) return s;
      const next = { ...s, answers: { ...s.answers, [me.id]: list as string[] } };
      return s.answerers.every((p) => next.answers[p.id]) ? startSaying(next, now) : next;
    }

    if (role !== 'ref') return s;
    // Someone left or is taking too long: carry on with the answers that are in.
    if (s.status === 'writing' && action === 'skip' && Object.keys(s.answers).length > 0) return startSaying(s, now);
    if (s.status === 'saying' && action === 'reveal' && now >= s.sayAt!) return { ...s, status: 'reveal' };
    if (s.status === 'reveal' && action === 'judge' && typeof payload.a === 'boolean' && typeof payload.b === 'boolean') {
      const matched = { a: payload.a, b: payload.b };
      if (matched.a === matched.b) return { ...s, status: 'replay', matched };
      return { ...s, status: 'result', matched, winner: matched.a ? 'b' : 'a', resultUntil: now + RESULT_MS };
    }
    if (s.status === 'replay' && action === 'next') return newPrompt(s, NOBODY, rng, s.number + 1);
    return s;
  },
  tick(s, now) {
    return s.status === 'result' && now >= s.resultUntil! ? { ...s, status: 'done' } : s;
  },
  result(s) {
    return s.status === 'done' ? s.winner : null;
  },
  project(s) {
    const shown = s.status === 'reveal' || s.status === 'replay' || s.status === 'result' || s.status === 'done';
    return {
      status: s.status,
      prompt: s.prompt.text,
      number: s.number,
      answerers: s.answerers,
      each: s.each,
      done: Object.keys(s.answers),
      answers: shown ? s.answers : null,
      sayAt: s.sayAt,
      matched: s.matched,
      winner: s.winner,
    };
  },
};
