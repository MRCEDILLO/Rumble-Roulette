import { CATEGORIES, makeClashLogic, type Category } from '../category-clash/logic';

/**
 * Letters that can be forbidden. Share of the 10,000 most common English words (3+ letters)
 * that contain each one: A 46%, I 45%, R/S/N 43%, T 41%, O 36%, L 29%, C 27%, D 25%,
 * U 19%, P 18%, G/M 17%, H 15%. That is enough to rule out plenty of answers without
 * emptying a category. Left out: E (61%, too harsh) and anything rarer than H, like
 * B, Y, F, W, K, V, X, J, Q, Z (11% or less, so they barely change anything).
 */
export const LETTERS = 'AIRSNTOLCDUPGMH'.split('');

/**
 * Category Clash categories that are about how words are spelled ("Words that start with S",
 * "Words that rhyme with cat"). A banned letter can make those impossible, so they're left out.
 */
export function isSpellingCategory(c: Category) {
  return /^words (that (rhyme|start|end)|with )/i.test(c.text);
}

export const FORBIDDEN_CATEGORIES = CATEGORIES.filter((c) => !isSpellingCategory(c));

/** A random letter from LETTERS, never the same one twice in a row. */
export function pickLetter(rng: () => number, avoid: string | null) {
  const pool = LETTERS.filter((l) => l !== avoid);
  return pool[Math.floor(rng() * pool.length)];
}

export const forbiddenCategoriesLogic = makeClashLogic({
  deck: 'forbidden-categories',
  categories: FORBIDDEN_CATEGORIES,
  pickLetter,
  info: {
    id: 'forbidden-categories',
    name: 'Forbidden Categories',
    rules:
      'Category Clash with a twist: no answer can have the forbidden letter anywhere in it! Take turns naming things in the category, then hit your buzzer to pass. Your 30-second clock only runs on your turn. Run out first and you lose!',
    refereeDuty:
      'Listen to every answer. Pause the clocks if one has the forbidden letter, is wrong or is repeated, then play on or send the turn back. You can swap the category or the letter before the clocks start.',
    icon: '🚫',
    color: '#9b5de5',
    category: 'word',
    scoring: 'referee',
  },
});
