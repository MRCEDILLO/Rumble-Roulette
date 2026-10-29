import { rpsViews } from './rps/views';
import { timerViews } from './timer/views';
import { TRIVIA_CATEGORIES } from './trivia/bank';
import { triviaGameId } from './trivia/logic';
import { triviaViews } from './trivia/views';
import type { MinigameViews } from './types';

/** Every minigame's screens. Add new games here (and their logic in logic.ts). */
export const GAME_VIEWS: Record<string, MinigameViews> = {
  rps: rpsViews,
  timer: timerViews,
  ...Object.fromEntries(TRIVIA_CATEGORIES.map((c) => [triviaGameId(c.id), triviaViews])),
};
