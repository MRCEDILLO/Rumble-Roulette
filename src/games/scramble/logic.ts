import type { MinigameLogic, Outcome } from '../types';
import { drawFrom } from '../trivia/deck';
import file from './words.txt?raw';

/** Name the used words are remembered under in the host's account. */
export const DECK = 'scramble';
/** Time to unscramble a word before it's swapped for a new one. */
export const SOLVE_MS = 60_000;
/** When the hints appear: the first letter, then the last letter too. */
export const HINT_AT_MS = [20_000, 40_000];
/** How long a missed word stays on screen before the next one. */
export const MISSED_MS = 4_000;
export const RESULT_MS = 5_000;

type Side = 'a' | 'b';

export interface Word {
  id: string;
  text: string;
}

/**
 * Reads the word file: one word per line, `#` lines are notes. Only letters A–Z count, and
 * repeats are skipped. Every word should have no other anagram, so the jumble can only be one word.
 */
export function parseWords(text: string): Word[] {
  const seen = new Set<string>();
  const out: Word[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim().toUpperCase();
    if (!t || t.startsWith('#') || !/^[A-Z]+$/.test(t) || seen.has(t)) continue;
    seen.add(t);
    out.push({ id: t, text: t });
  }
  return out;
}

export const WORDS = parseWords(file);

/** A typed guess in capitals with anything that isn't a letter dropped. */
export const cleanGuess = (text: unknown) => String(text ?? '').toUpperCase().replace(/[^A-Z]/g, '');

/**
 * The word's letters in a random order. Never the word itself, and never starting with the word's
 * first letter (when the word has another letter to start with), so it always looks jumbled.
 */
export function scramble(word: string, rng: () => number): string {
  const canMoveFirst = word.split('').some((l) => l !== word[0]);
  let best = word;
  for (let i = 0; i < 30; i++) {
    const letters = word.split('');
    for (let j = letters.length - 1; j > 0; j--) {
      const k = Math.floor(rng() * (j + 1));
      [letters[j], letters[k]] = [letters[k], letters[j]];
    }
    const out = letters.join('');
    if (out !== word) best = out;
    if (out !== word && (!canMoveFirst || out[0] !== word[0])) return out;
  }
  return best;
}

export interface ScrambleState {
  /** playing: the race. missed: nobody got it in time, the word is shown. result: someone got it. */
  status: 'playing' | 'missed' | 'result' | 'done';
  word: Word;
  letters: string;
  /** Which word of the duel this is (1 for the first). */
  wordNo: number;
  endsAt: number;
  /** 0 = no hints yet, 1 = first letter shown, 2 = first and last letters shown. */
  hints: number;
  /** Wrong guesses each duelist has sent for this word. */
  wrong: Record<Side, number>;
  pauseUntil: number | null;
  winner: Outcome | null;
}

export interface ScrambleView {
  status: ScrambleState['status'];
  letters: string;
  wordNo: number;
  endsAt: number;
  /** The answer with only the hint letters filled in (all of it once the word is over). */
  slots: (string | null)[];
  hints: number;
  wrong: Record<Side, number>;
  /** Hidden from phones until the word is over. */
  answer: string | null;
  winner: Outcome | null;
}

function newWord(s: ScrambleState | null, now: number, rng: () => number): ScrambleState {
  const word = drawFrom(DECK, WORDS, rng, s?.word.id);
  return {
    status: 'playing',
    word,
    letters: scramble(word.text, rng),
    wordNo: (s?.wordNo ?? 0) + 1,
    endsAt: now + SOLVE_MS,
    hints: 0,
    wrong: { a: 0, b: 0 },
    pauseUntil: null,
    winner: null,
  };
}

const miss = (s: ScrambleState, now: number): ScrambleState => ({ ...s, status: 'missed', pauseUntil: now + MISSED_MS });

export const scrambleLogic: MinigameLogic<ScrambleState, ScrambleView> = {
  info: {
    id: 'scramble',
    name: 'Scramble',
    rules: 'Unscramble the jumbled letters on the big screen. First to type the word on their phone wins!',
    refereeDuty: 'You can see the answer: keep it secret! Skip the word if it’s too hard. The game scores itself.',
    icon: '🔀',
    color: '#ff9f43',
    category: 'word',
    scoring: 'auto',
  },
  init(now, rng) {
    return newWord(null, now, rng);
  },
  onInput(s, role, payload, now) {
    if (s.status !== 'playing') return s;
    const action = payload?.action;
    if ((role === 'a' || role === 'b') && action === 'guess') {
      const guess = cleanGuess(payload.text);
      if (!guess) return s;
      // Inputs reach the host one at a time, so whoever's right answer lands first wins.
      if (guess === s.word.text) return { ...s, status: 'result', winner: role, pauseUntil: now + RESULT_MS };
      return { ...s, wrong: { ...s.wrong, [role]: s.wrong[role] + 1 } };
    }
    // The Host can swap a word nobody is getting.
    if (role === 'ref' && action === 'skip') return miss(s, now);
    return s;
  },
  tick(s, now, rng) {
    if (s.status === 'playing') {
      if (now >= s.endsAt) return miss(s, now);
      const left = s.endsAt - now;
      const hints = HINT_AT_MS.filter((at) => left <= SOLVE_MS - at).length;
      return hints !== s.hints ? { ...s, hints } : s;
    }
    if (s.pauseUntil !== null && now >= s.pauseUntil) {
      // Nobody got it: a fresh word, same duel.
      if (s.status === 'missed') return newWord(s, now, rng);
      if (s.status === 'result') return { ...s, status: 'done' };
    }
    return s;
  },
  result(s) {
    return s.status === 'done' ? s.winner : null;
  },
  project(s) {
    const over = s.status !== 'playing';
    const text = s.word.text;
    const last = text.length - 1;
    return {
      status: s.status,
      letters: s.letters,
      wordNo: s.wordNo,
      endsAt: s.endsAt,
      slots: text.split('').map((l, i) => (over || (s.hints >= 1 && i === 0) || (s.hints >= 2 && i === last) ? l : null)),
      hints: s.hints,
      wrong: s.wrong,
      answer: over ? text : null,
      winner: over ? s.winner : null,
    };
  },
};
