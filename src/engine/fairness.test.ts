import { expect, it } from 'vitest';
import { addSeat, applyInput, createState, refAction, startGame, tick } from './engine';

// Plays many whole games and checks duel and referee turns are shared as evenly as possible.
it('shares duels and referee turns evenly for every player count', () => {
  for (const n of [3, 4, 5, 6, 7, 8, 9, 10]) {
    for (const rounds of [7, 10, 13, 20, 30]) {
      for (let seed = 1; seed <= 12; seed++) {
        let x = seed * 7919;
        const rng = () => {
          x ^= x << 13;
          x ^= x >>> 17;
          x ^= x << 5;
          return ((x >>> 0) % 1e6) / 1e6;
        };
        let s = createState('TEST', 'party', rounds, ['rps'], 0);
        for (let i = 0; i < n; i++) {
          s = addSeat(s, `p${i}`, `q${i}`, { name: `P${i}`, color: `c${i}`, accessory: 'none' }, 0, rng);
        }
        s = startGame(s, 0, rng);
        const duels: Record<string, number> = Object.fromEntries(s.order.map((id) => [id, 0]));
        const refs: Record<string, number> = Object.fromEntries(s.order.map((id) => [id, 0]));
        let t = 0;
        for (let r = 0; r < rounds; r++) {
          const d = s.duel!;
          duels[d.a]++;
          duels[d.b]++;
          refs[d.ref!]++;
          for (let k = 0; k < 3; k++) s = tick(s, (t += 1e6), rng);
          while (s.phase === 'duel') {
            s = applyInput(s, d.a, { t: 'game', payload: { pick: 'rock' } }, t, rng);
            s = applyInput(s, d.b, { t: 'game', payload: { pick: 'scissors' } }, t, rng);
            s = tick(s, (t += 1e5), rng);
          }
          s = refAction(s, 'next', t, rng);
        }
        const spread = (v: Record<string, number>) => Math.max(...Object.values(v)) - Math.min(...Object.values(v));
        const label = `${n} players, ${rounds} rounds, seed ${seed}`;
        expect(spread(duels), label).toBe((2 * rounds) % n === 0 ? 0 : 1);
        expect(spread(refs), label).toBeLessThanOrEqual(rounds % n === 0 ? 0 : 1);
      }
    }
  }
}, 120_000);
