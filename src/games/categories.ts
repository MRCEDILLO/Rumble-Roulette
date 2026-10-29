import type { GameCategory } from './types';

/** Every game category, in the order the setup screen shows them. Icons are in CategoryIcon.tsx. */
export const CATEGORIES: { id: GameCategory; name: string }[] = [
  { id: 'trivia', name: 'Trivia' },
  { id: 'word', name: 'Word Games' },
  { id: 'chance', name: 'Chance Games' },
  { id: 'puzzle', name: 'Puzzle Games' },
  { id: 'card', name: 'Card Games' },
  { id: 'physical', name: 'Physical Games' },
  { id: 'misc', name: 'Miscellaneous Games' },
];

export const ALL_CATEGORY_IDS = CATEGORIES.map((c) => c.id);
