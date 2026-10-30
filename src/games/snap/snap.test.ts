import { describe, expect, it } from 'vitest';
import {
  DEAL_END_MS,
  DEAL_START_MS,
  GRACE_MS,
  REVEAL_MS,
  SHUFFLE_MS,
  SNAPOFF_MS,
  SNAP_PAUSE_MS,
  TIME_MS,
  dealGap,
  dealPair,
  sameCard,
  snapLogic as logic,
  type Card,
  type SnapState,
} from './logic';

const snap = (s: SnapState, side: 'a' | 'b', now: number, deal = s.deal?.id) => logic.onInput(s, side, { action: 'snap', deal }, now, Math.random);
const card: Card = { shape: 'star', color: 'red', fill: 'solid' };
/** Puts a chosen pair on the table, dealt at `at`. */
const table = (s: SnapState, match: boolean, at = s.startedAt): SnapState => ({
  ...s,
  status: s.status === 'shuffling' ? 'playing' : s.status,
  prev: s.deal,
  deal: { id: s.dealt + 1, left: card, right: match ? { ...card } : { ...card, fill: 'striped' }, match, at, claimed: null },
  dealt: s.dealt + 1,
  nextDealAt: at + DEAL_START_MS,
});
const start = () => table(logic.init(0, Math.random), true);

describe('Snap!', () => {
  it('deals matches about a quarter of the time, and most other pairs are near misses', () => {
    let matches = 0;
    let near = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const p = dealPair(Math.random);
      expect(p.match).toBe(sameCard(p.left, p.right));
      if (p.match) matches++;
      else {
        const same = [p.left.shape === p.right.shape, p.left.color === p.right.color, p.left.fill === p.right.fill].filter(Boolean).length;
        if (same === 2) near++;
      }
    }
    expect(matches / N).toBeGreaterThan(0.2);
    expect(matches / N).toBeLessThan(0.35);
    expect(near / (N - matches)).toBeGreaterThan(0.6);
  });

  it('shuffles first, then deals faster as the minute goes on', () => {
    let s = logic.init(0, Math.random);
    s = logic.tick!(s, SHUFFLE_MS - 1, Math.random);
    expect(s.deal).toBeNull();
    s = logic.tick!(s, SHUFFLE_MS, Math.random);
    expect(s.status).toBe('playing');
    expect(s.deal?.id).toBe(1);
    expect(s.nextDealAt).toBe(SHUFFLE_MS + DEAL_START_MS);
    expect(dealGap(s, SHUFFLE_MS + TIME_MS)).toBe(DEAL_END_MS);
    s = logic.tick!(s, s.nextDealAt, Math.random);
    expect(s.deal?.id).toBe(2);
    expect(s.prev?.id).toBe(1);
  });

  it('a good snap scores a point and pauses the table; the slower snap just misses out', () => {
    let s = start();
    s = snap(s, 'a', s.startedAt + 300);
    expect(s.scores).toEqual({ a: 1, b: 0 });
    expect(s.deal?.claimed).toBe('a');
    expect(s.nextDealAt).toBeGreaterThanOrEqual(s.startedAt + 300 + SNAP_PAUSE_MS);
    s = snap(s, 'b', s.startedAt + 350);
    expect(s.scores).toEqual({ a: 1, b: 0 });
    expect(s.last.b?.kind).toBe('late');
  });

  it('a wrong snap costs a point, scores can go below zero, and a double tap only counts once', () => {
    let s = table(logic.init(0, Math.random), false);
    s = snap(s, 'b', s.startedAt + 200);
    s = snap(s, 'b', s.startedAt + 250);
    expect(s.scores).toEqual({ a: 0, b: -1 });
    expect(s.last.b?.kind).toBe('wrong');
  });

  it('a snap that arrives just after the next deal still counts for the pair that phone saw', () => {
    let s = start();
    const first = s.deal!.id;
    s = table(s, false, s.startedAt + 2000);
    expect(snap(s, 'a', s.deal!.at + GRACE_MS, first).scores.a).toBe(1);
    expect(snap(s, 'a', s.deal!.at + GRACE_MS + 1, first).scores.a).toBe(0);
  });

  it('most points after a minute wins', () => {
    let s = snap(start(), 'b', 100);
    s = logic.tick!(s, s.endsAt, Math.random);
    expect(s.status).toBe('reveal');
    expect(s.winner).toBe('b');
    expect(logic.result(s)).toBeNull();
    s = logic.tick!(s, s.endsAt + REVEAL_MS, Math.random);
    expect(logic.result(s)).toBe('b');
  });

  it('a tie goes to sudden death: next good snap wins, a wrong one loses', () => {
    let s = logic.tick!(start(), TIME_MS + SHUFFLE_MS, Math.random);
    expect(s.status).toBe('snapoff');
    const won = snap(table(s, true, s.deal!.at), 'a', s.deal!.at + 100);
    expect(won.status).toBe('reveal');
    expect(won.winner).toBe('a');
    const lost = snap(table(s, false, s.deal!.at), 'a', s.deal!.at + 100);
    expect(lost.winner).toBe('b');
    expect(lost.how).toBe('snapoff-wrong');
  });

  it('sudden death with no snaps at all is a draw, so the duel is replayed', () => {
    let s = logic.tick!(start(), TIME_MS + SHUFFLE_MS, Math.random);
    s = logic.tick!(s, s.endsAt, Math.random);
    expect(s.winner).toBe('draw');
    expect(s.endsAt - (TIME_MS + SHUFFLE_MS)).toBe(SNAPOFF_MS);
  });

  it('ignores snaps from anyone but the duelists, and before the cards are down', () => {
    const s = logic.init(0, Math.random);
    expect(logic.onInput(s, 'a', { action: 'snap' }, 10, Math.random)).toBe(s);
    const t = start();
    expect(logic.onInput(t, 'ref', { action: 'snap', deal: 1 }, t.startedAt + 10, Math.random)).toBe(t);
    expect(logic.onInput(t, 'audience', { action: 'snap', deal: 1 }, t.startedAt + 10, Math.random)).toBe(t);
  });
});
