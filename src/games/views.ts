import { celebrityHeadsViews } from './celebrity-heads/views';
import { firstLastViews } from './first-last/views';
import { hangmanViews } from './hangman/views';
import { higherLowerViews } from './higher-lower/views';
import { jinxViews } from './jinx/views';
import { memoryFlipViews } from './memory-flip/views';
import { rpsViews } from './rps/views';
import { snapViews } from './snap/views';
import { stackToeViews } from './stack-toe/views';
import { timerViews } from './timer/views';
import { TRIVIA_CATEGORIES } from './trivia/bank';
import { triviaGameId } from './trivia/logic';
import { triviaViews } from './trivia/views';
import type { MinigameViews } from './types';
import { wantedViews } from './wanted/views';
import { whatsMyNumberViews } from './whats-my-number/views';

/** Every minigame's screens. Add new games here (and their logic in logic.ts). */
export const GAME_VIEWS: Record<string, MinigameViews> = {
  rps: rpsViews,
  timer: timerViews,
  'higher-lower': higherLowerViews,
  'first-last': firstLastViews,
  hangman: hangmanViews,
  'stack-toe': stackToeViews,
  'memory-flip': memoryFlipViews,
  'celebrity-heads': celebrityHeadsViews,
  'whats-my-number': whatsMyNumberViews,
  wanted: wantedViews,
  jinx: jinxViews,
  snap: snapViews,
  ...Object.fromEntries(TRIVIA_CATEGORIES.map((c) => [triviaGameId(c.id), triviaViews])),
};
