import { describe, expect, it } from 'vitest';
import type { Spin } from '../engine/types';
import { MAX_WHEEL_GAMES, wheelAngle, wheelGames } from './Wheel';

const pool = (n: number) => Array.from({ length: n }, (_, i) => `game-${i}`);
const spin = (options: string[], gameId: string, startedAt = 1234): Spin => ({ options, gameId, startedAt, turns: 4 });

describe('wheel with a big pool', () => {
  it('shows every game when the pool is small', () => {
    const options = pool(MAX_WHEEL_GAMES);
    expect(wheelGames(spin(options, 'game-3'))).toEqual(options);
  });

  it('shows at most MAX_WHEEL_GAMES, always including the chosen game', () => {
    for (let t = 0; t < 200; t++) {
      const options = pool(50);
      const gameId = options[t % 50];
      const shown = wheelGames(spin(options, gameId, t * 7919));
      expect(shown).toHaveLength(MAX_WHEEL_GAMES);
      expect(new Set(shown).size).toBe(MAX_WHEEL_GAMES);
      expect(shown).toContain(gameId);
      shown.forEach((id) => expect(options).toContain(id));
    }
  });

  it('draws the same wheel on every frame of a spin', () => {
    const s = spin(pool(50), 'game-17');
    expect(wheelGames(s)).toEqual(wheelGames(s));
  });

  it('stops on the chosen game', () => {
    const s = spin(pool(50), 'game-42', 99);
    const { angle, slices, seg, done } = wheelAngle(s, s.startedAt + 60_000);
    expect(done).toBe(true);
    // The slice under the pointer (at the top) after the wheel turns by `angle`.
    const under = Math.floor((((360 - (angle % 360)) % 360) / seg));
    expect(slices[under]).toBe('game-42');
  });
});
