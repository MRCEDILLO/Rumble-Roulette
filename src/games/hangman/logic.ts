import type { MinigameLogic, Outcome } from '../types';

type Side = 'a' | 'b';

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
/**
 * Wrong letters before you're hanged: head, body, two arms, two legs. The classic six is enough to
 * solve most everyday words with sensible guessing, but a sneaky word (JAZZ, RHYTHM) can still beat you.
 */
export const MAX_MISSES = 6;
export const MIN_LETTERS = 3;
export const MAX_LETTERS = 20;
export const WRITE_MS = 60_000;
/** Extra time for someone whose word the Host sent back. */
export const REWRITE_MS = 30_000;
export const REVEAL_MS = 5_000;

/** Used when someone doesn't type a word in time. */
export const SPARE_WORDS = [
  'BANANA', 'PIRATE', 'ROCKET', 'GUITAR', 'PENGUIN', 'CASTLE', 'DRAGON', 'JUNGLE', 'WIZARD', 'PICNIC',
  'TORNADO', 'VOLCANO', 'PUZZLE', 'KETCHUP', 'MONKEY', 'BLANKET', 'CAMERA', 'DOLPHIN', 'GALAXY', 'HAMMER',
  'ISLAND', 'JACKET', 'KITTEN', 'LADDER', 'MAGNET', 'NAPKIN', 'OYSTER', 'PARROT', 'QUILT', 'RIBBON',
  'SANDWICH', 'TRUMPET', 'UMBRELLA', 'VIOLIN', 'WALRUS', 'YOGURT', 'ZIPPER', 'BISCUIT', 'CACTUS', 'DONUT',
];

/** A typed word in capitals, or null if it isn't one word of 3–20 letters A–Z. */
export function cleanWord(text: string): string | null {
  const word = text.trim().toUpperCase();
  return new RegExp(`^[A-Z]{${MIN_LETTERS},${MAX_LETTERS}}$`).test(word) ? word : null;
}

export const otherSide = (s: Side): Side => (s === 'a' ? 'b' : 'a');

export interface HangmanState {
  /** writing: duelists type a word and the Host checks it. guessing: the race. reveal: both words shown. */
  status: 'writing' | 'guessing' | 'reveal' | 'done';
  /** The word each duelist wrote, for the OTHER duelist to guess. */
  words: Record<Side, string | null>;
  /** The Host has checked it's a real word (spare words count as checked). */
  approved: Record<Side, boolean>;
  /** The Host sent this duelist's word back, so their phone can say why. */
  rejected: Record<Side, boolean>;
  /** Picked for them because they ran out of time. */
  spare: Record<Side, boolean>;
  writeEndsAt: number;
  /** Letters each duelist has tried on the word they're guessing, in order. */
  guesses: Record<Side, string[]>;
  revealUntil: number | null;
  winner: Outcome | null;
}

/** One duelist's progress on the word they're guessing. */
export interface Board {
  /** One entry per letter of the word: the letter once found, otherwise null. */
  pattern: (string | null)[];
  hits: string[];
  misses: string[];
  solved: boolean;
  hanged: boolean;
}

export interface HangmanView {
  status: HangmanState['status'];
  /** Whether each duelist has a word in (waiting for the Host or checked). */
  written: Record<Side, boolean>;
  approved: Record<Side, boolean>;
  rejected: Record<Side, boolean>;
  spare: Record<Side, boolean>;
  /**
   * The words, only while the Host is checking them and after the race. Each phone's screen only
   * shows what it's allowed to.
   */
  words: Record<Side, string | null>;
  writeEndsAt: number;
  /** Keyed by who is guessing. Null until the race starts. */
  boards: Record<Side, Board> | null;
  winner: Outcome | null;
}

export function board(word: string, guesses: string[]): Board {
  const hits = guesses.filter((l) => word.includes(l));
  const misses = guesses.filter((l) => !word.includes(l));
  const pattern = word.split('').map((l) => (guesses.includes(l) ? l : null));
  return {
    pattern,
    hits,
    misses,
    solved: pattern.every((l) => l !== null),
    hanged: misses.length >= MAX_MISSES,
  };
}

/** The board of whoever is guessing: they guess the word the other one wrote. */
const boardOf = (s: HangmanState, guesser: Side) => board(s.words[otherSide(guesser)]!, s.guesses[guesser]);

function startIfReady(s: HangmanState): HangmanState {
  return s.approved.a && s.approved.b ? { ...s, status: 'guessing' } : s;
}

const finish = (s: HangmanState, winner: Outcome, now: number): HangmanState => ({
  ...s,
  status: 'reveal',
  winner,
  revealUntil: now + REVEAL_MS,
});

export const hangmanLogic: MinigameLogic<HangmanState, HangmanView> = {
  info: {
    id: 'hangman',
    name: 'Hangman',
    rules: `Secretly type a word for your opponent. Then race to guess yours letter by letter: ${MAX_MISSES} wrong letters and you’re hanged. First to solve it wins!`,
    refereeDuty: 'Check both secret words are real words and send back any that aren’t. Keep them secret! Then the game scores itself.',
    icon: '🪢',
    color: '#b58cff',
    category: 'word',
    scoring: 'auto',
  },
  init(now) {
    return {
      status: 'writing',
      words: { a: null, b: null },
      approved: { a: false, b: false },
      rejected: { a: false, b: false },
      spare: { a: false, b: false },
      writeEndsAt: now + WRITE_MS,
      guesses: { a: [], b: [] },
      revealUntil: null,
      winner: null,
    };
  },
  onInput(s, role, payload, now) {
    const action = payload?.action;

    if (s.status === 'writing') {
      if ((role === 'a' || role === 'b') && action === 'word' && s.words[role] === null) {
        const word = cleanWord(String(payload.word ?? ''));
        if (!word) return s;
        return { ...s, words: { ...s.words, [role]: word }, rejected: { ...s.rejected, [role]: false } };
      }
      if (role === 'ref' && action === 'check' && (payload.side === 'a' || payload.side === 'b')) {
        const side: Side = payload.side;
        if (s.words[side] === null || s.approved[side]) return s;
        if (payload.ok === true) return startIfReady({ ...s, approved: { ...s.approved, [side]: true } });
        // Sent back: they type another one, with enough time left to do it.
        return {
          ...s,
          words: { ...s.words, [side]: null },
          rejected: { ...s.rejected, [side]: true },
          writeEndsAt: Math.max(s.writeEndsAt, now + REWRITE_MS),
        };
      }
      return s;
    }

    if (s.status === 'guessing' && (role === 'a' || role === 'b') && action === 'guess') {
      const letter = String(payload.letter ?? '').toUpperCase();
      const mine = boardOf(s, role);
      if (!LETTERS.includes(letter) || s.guesses[role].includes(letter) || mine.solved || mine.hanged) return s;
      const next = { ...s, guesses: { ...s.guesses, [role]: [...s.guesses[role], letter] } };
      const after = boardOf(next, role);
      // First to solve wins. Hanged means you're out, and if you're both out it's a draw.
      if (after.solved) return finish(next, role, now);
      if (after.hanged && boardOf(next, otherSide(role)).hanged) return finish(next, 'draw', now);
      return next;
    }
    return s;
  },
  tick(s, now, rng) {
    if (s.status === 'writing' && now >= s.writeEndsAt) {
      // Out of time: anyone without a word gets a spare one. Words waiting on the Host stay put.
      const next = { ...s, words: { ...s.words }, approved: { ...s.approved }, spare: { ...s.spare } };
      for (const side of ['a', 'b'] as Side[]) {
        if (next.words[side] !== null) continue;
        next.words[side] = SPARE_WORDS[Math.floor(rng() * SPARE_WORDS.length)];
        next.approved[side] = true;
        next.spare[side] = true;
      }
      return startIfReady(next);
    }
    if (s.status === 'reveal' && s.revealUntil !== null && now >= s.revealUntil) return { ...s, status: 'done' };
    return s;
  },
  result(s) {
    return s.status === 'done' ? s.winner : null;
  },
  project(s) {
    const racing = s.status !== 'writing';
    const ended = s.status === 'reveal' || s.status === 'done';
    return {
      status: s.status,
      written: { a: s.words.a !== null, b: s.words.b !== null },
      approved: s.approved,
      rejected: s.rejected,
      spare: s.spare,
      // Spare words stay hidden too: nobody needs to check those.
      words: ended
        ? s.words
        : s.status === 'writing'
          ? { a: s.spare.a ? null : s.words.a, b: s.spare.b ? null : s.words.b }
          : { a: null, b: null },
      writeEndsAt: s.writeEndsAt,
      boards: racing ? { a: boardOf(s, 'a'), b: boardOf(s, 'b') } : null,
      winner: ended ? s.winner : null,
    };
  },
};
