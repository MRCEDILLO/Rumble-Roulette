import type { MinigameLogic } from './types';
import { rpsLogic } from './rps/logic';
import { timerLogic } from './timer/logic';

/** Every minigame's logic. Add new games here (and their views in views.ts). */
export const GAME_LOGIC: Record<string, MinigameLogic> = {
  [rpsLogic.info.id]: rpsLogic,
  [timerLogic.info.id]: timerLogic,
};

export const ALL_GAME_IDS = Object.keys(GAME_LOGIC);

export function gameInfo(id: string) {
  return GAME_LOGIC[id]?.info;
}
