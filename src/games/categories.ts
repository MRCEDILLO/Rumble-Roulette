import type { GameCategory } from './types';

/** Every game category, in the order the setup screen shows them. */
export const CATEGORIES: { id: GameCategory; name: string; icon: string }[] = [
  { id: 'trivia', name: 'Trivia', icon: '🧠' },
  { id: 'word', name: 'Word Games', icon: '🔤' },
  { id: 'chance', name: 'Chance Games', icon: '🎲' },
  { id: 'physical', name: 'Physical Games', icon: '🏃' },
  { id: 'misc', name: 'Miscellaneous Games', icon: '✨' },
];

export const ALL_CATEGORY_IDS = CATEGORIES.map((c) => c.id);
