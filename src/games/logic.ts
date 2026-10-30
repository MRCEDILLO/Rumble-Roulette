import type { MinigameLogic } from './types';
import { firstLastLogic } from './first-last/logic';
import { hangmanLogic } from './hangman/logic';
import { higherLowerLogic } from './higher-lower/logic';
import { rpsLogic } from './rps/logic';
import { stackToeLogic } from './stack-toe/logic';
import { timerLogic } from './timer/logic';
import { TRIVIA_CATEGORIES } from './trivia/bank';
import { makeTriviaLogic } from './trivia/logic';

/** Every minigame's logic. Add new games here (and their views in views.ts). */
export const GAME_LOGIC: Record<string, MinigameLogic> = {
  [rpsLogic.info.id]: rpsLogic,
  [timerLogic.info.id]: timerLogic,
  [higherLowerLogic.info.id]: higherLowerLogic,
  [firstLastLogic.info.id]: firstLastLogic,
  [hangmanLogic.info.id]: hangmanLogic,
  [stackToeLogic.info.id]: stackToeLogic,
  // One game per trivia category.
  ...Object.fromEntries(
    TRIVIA_CATEGORIES.map((c) => {
      const logic = makeTriviaLogic(c);
      return [logic.info.id, logic];
    }),
  ),
};

export const ALL_GAME_IDS = Object.keys(GAME_LOGIC);

export function gameInfo(id: string) {
  return GAME_LOGIC[id]?.info;
}

/** Whether a game's name contains the search text (an empty search matches everything). */
export function matchesSearch(id: string, search: string) {
  return gameInfo(id)!.name.toLowerCase().includes(search.trim().toLowerCase());
}
