import type { MinigameLogic, Outcome } from '../types';
import { drawFrom } from '../trivia/deck';
import { CELEBRITIES, type Celebrity } from './bank';

/** Name the used characters are remembered under in the host's account. */
export const DECK = 'celebrity-heads';
/** How long both characters stay up on the big screen once someone guesses theirs. */
export const REVEAL_MS = 6_000;

type Side = 'a' | 'b';

export interface CelebrityHeadsState {
  /**
   * drawing: the Host can redraw before starting. asking: players take turns asking questions.
   * reveal: someone guessed theirs, both characters are shown. done: the result is in.
   */
  status: 'drawing' | 'asking' | 'reveal' | 'done';
  characters: Record<Side, Celebrity>;
  /** Who asks the first question (they take turns from there). */
  first: Side;
  winner: Outcome | null;
  revealUntil: number | null;
}

/** Everyone gets the same view; the duelists' phones and the big screen just don't show the characters. */
export type CelebrityHeadsView = CelebrityHeadsState;

/** A character the host hasn't had lately, and never the same as the other duelist's. */
function drawCharacter(rng: () => number, other?: Celebrity): Celebrity {
  for (let i = 0; i < 10; i++) {
    const c = drawFrom(DECK, CELEBRITIES, rng, other?.id);
    if (c.id !== other?.id) return c;
  }
  return CELEBRITIES.find((c) => c.id !== other?.id)!;
}

export const celebrityHeadsLogic: MinigameLogic<CelebrityHeadsState, CelebrityHeadsView> = {
  info: {
    id: 'celebrity-heads',
    name: 'Celebrity Heads',
    rules:
      'You each get a secret famous person or character. Take turns asking the room yes or no questions. First to guess who they are wins!',
    refereeDuty:
      'Check both characters and redraw any nobody knows, then start. Help the audience answer yes or no, and tap the player who guesses right.',
    icon: '🎭',
    color: '#ff8fc8',
    category: 'misc',
    scoring: 'referee',
  },
  init(_now, rng) {
    const a = drawCharacter(rng);
    return {
      status: 'drawing',
      characters: { a, b: drawCharacter(rng, a) },
      first: rng() < 0.5 ? 'a' : 'b',
      winner: null,
      revealUntil: null,
    };
  },
  onInput(s, role, payload, now, rng) {
    if (role !== 'ref') return s;
    const action = payload?.action;
    const side: Side | null = payload?.side === 'a' || payload?.side === 'b' ? payload.side : null;
    if (s.status === 'drawing' && action === 'redraw' && side) {
      const other = side === 'a' ? 'b' : 'a';
      return { ...s, characters: { ...s.characters, [side]: drawCharacter(rng, s.characters[other]) } };
    }
    if (s.status === 'drawing' && action === 'begin') return { ...s, status: 'asking' };
    if (s.status === 'asking' && action === 'guessed' && side) {
      return { ...s, status: 'reveal', winner: side, revealUntil: now + REVEAL_MS };
    }
    return s;
  },
  tick(s, now) {
    return s.status === 'reveal' && now >= s.revealUntil! ? { ...s, status: 'done' } : s;
  },
  result(s) {
    return s.status === 'done' ? s.winner : null;
  },
  project(s) {
    return s;
  },
};
