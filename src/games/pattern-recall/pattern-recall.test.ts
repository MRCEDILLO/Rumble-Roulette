import { describe, expect, it } from 'vitest';
import { MAX_LEN, PADS, REVEAL_MS, ROUND_PAUSE_MS, START_LEN, patternRecallLogic as logic, makePattern, type PatternState } from './logic';

const rng = Math.random;
const press = (s: PatternState, side: 'a' | 'b', pad: number, now = s.inputAt) => logic.onInput(s, side, { action: 'press', pad }, now, rng);
const toInput = (s: PatternState) => logic.tick!(s, s.inputAt, rng);
const wrong = (pad: number) => (pad + 1) % PADS.length;
/** Presses the whole pattern right, `ms` after input opens. */
const repeat = (s: PatternState, side: 'a' | 'b', ms = 0) => s.pattern.reduce((st, pad) => press(st, side, pad, s.inputAt + ms), s);
/** Gets past one round with both right, ready for input on the next. */
const bothRight = (s: PatternState) => {
  s = repeat(repeat(s, 'a'), 'b');
  return toInput(logic.tick!(s, s.nextAt!, rng));
};

describe('Pattern Recall', () => {
  it('makes patterns of the right length with no pad three times running', () => {
    for (let n = 0; n < 500; n++) {
      const p = makePattern(MAX_LEN, rng);
      expect(p).toHaveLength(MAX_LEN);
      p.forEach((pad, i) => {
        expect(pad).toBeGreaterThanOrEqual(0);
        expect(pad).toBeLessThan(PADS.length);
        if (i >= 2) expect(pad === p[i - 1] && pad === p[i - 2]).toBe(false);
      });
    }
  });

  it('shows the pattern, then hides it from phones while they repeat it', () => {
    const s = logic.init(0, rng);
    expect(s.pattern).toHaveLength(START_LEN);
    expect(logic.project(s).pattern).toEqual(s.pattern);
    const playing = toInput(s);
    expect(playing.status).toBe('input');
    expect(logic.project(playing).pattern).toBeNull();
    expect(logic.project(playing).length).toBe(START_LEN);
  });

  it('ignores presses while the pattern is still showing', () => {
    const s = logic.init(0, rng);
    expect(press(s, 'a', s.pattern[0], s.inputAt - 1)).toBe(s);
  });

  it('grows by one each round both get right, and gets quicker', () => {
    let s = toInput(logic.init(0, rng));
    const first = s.inputAt - s.showAt;
    s = bothRight(s);
    expect(s.round).toBe(2);
    expect(s.pattern).toHaveLength(START_LEN + 1);
    expect((s.inputAt - s.showAt) / s.pattern.length).toBeLessThan(first / START_LEN);
  });

  it('a slip loses to someone who gets it', () => {
    let s = toInput(logic.init(0, rng));
    s = press(s, 'a', wrong(s.pattern[0]));
    expect(s.progress.a).toBe('out');
    expect(s.status).toBe('input');
    s = repeat(s, 'b');
    expect(s.status).toBe('between');
    expect(s.roundEnd).toEqual({ kind: 'win', side: 'b', why: 'only' });
    expect(logic.result(s)).toBeNull();
    s = logic.tick!(s, s.nextAt!, rng);
    expect(logic.result(s)).toBe('b');
  });

  it('waits for the other duelist even when one has already got it', () => {
    let s = toInput(logic.init(0, rng));
    s = repeat(s, 'a');
    expect(s.status).toBe('input');
    s = repeat(s, 'b');
    expect(s.roundEnd).toEqual({ kind: 'both' });
    expect(s.nextAt).toBe(s.inputAt + ROUND_PAUSE_MS);
  });

  it('both slip: whoever got further wins; same spot replays the same length', () => {
    let s = toInput(logic.init(0, rng));
    s = press(s, 'a', s.pattern[0]);
    s = press(s, 'a', wrong(s.pattern[1]));
    s = press(s, 'b', wrong(s.pattern[0]));
    expect(s.roundEnd).toEqual({ kind: 'win', side: 'a', why: 'further' });
    expect(s.nextAt).toBe(s.inputAt + REVEAL_MS);

    let t = toInput(logic.init(0, rng));
    t = press(press(t, 'a', wrong(t.pattern[0])), 'b', wrong(t.pattern[0]));
    expect(t.roundEnd).toEqual({ kind: 'replay' });
    const old = t.pattern;
    t = logic.tick!(t, t.nextAt!, rng);
    expect(t.status).toBe('showing');
    expect(t.round).toBe(2);
    expect(t.pattern).toHaveLength(START_LEN);
    expect(t.pattern).not.toBe(old);
  });

  it('running out of time counts as a slip', () => {
    let s = toInput(logic.init(0, rng));
    s = press(s, 'a', s.pattern[0]);
    s = logic.tick!(s, s.endsAt, rng);
    expect(s.timedOut).toEqual({ a: true, b: true });
    expect(s.roundEnd).toEqual({ kind: 'win', side: 'a', why: 'further' });
  });

  it('at the longest pattern, the quicker one wins', () => {
    let s = toInput(logic.init(0, rng));
    while (s.pattern.length < MAX_LEN) s = bothRight(s);
    s = repeat(repeat(s, 'a', 4000), 'b', 3000);
    expect(s.roundEnd).toEqual({ kind: 'win', side: 'b', why: 'quicker' });
  });

  it('only the duelists can press, and only real pads, and nothing after slipping', () => {
    const s = toInput(logic.init(0, rng));
    expect(logic.onInput(s, 'ref', { action: 'press', pad: s.pattern[0] }, s.inputAt, rng)).toBe(s);
    expect(logic.onInput(s, 'audience', { action: 'press', pad: s.pattern[0] }, s.inputAt, rng)).toBe(s);
    expect(press(s, 'a', PADS.length)).toBe(s);
    expect(press(s, 'a', -1)).toBe(s);
    const out = press(s, 'a', wrong(s.pattern[0]));
    expect(press(out, 'a', s.pattern[0])).toBe(out);
  });
});
