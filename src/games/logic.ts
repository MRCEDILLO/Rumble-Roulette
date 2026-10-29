import type { MinigameLogic } from './types';
import { higherLowerLogic } from './higher-lower/logic';
import { rpsLogic } from './rps/logic';
import { timerLogic } from './timer/logic';
import { TRIVIA_CATEGORIES } from './trivia/bank';
import { makeTriviaLogic } from './trivia/logic';

/** Every minigame's logic. Add new games here (and their views in views.ts). */
export const GAME_LOGIC: Record<string, MinigameLogic> = {
  [rpsLogic.info.id]: rpsLogic,
  [timerLogic.info.id]: timerLogic,
  [higherLowerLogic.info.id]: higherLowerLogic,
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
