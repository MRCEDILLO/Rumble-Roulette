import type { MinigameLogic, Outcome } from '../types';

export const MAX_MS = 30_000;
/** Host-side safety stop if the referee's phone never sends Stop. */
const HOST_GRACE_MS = 2_000;

export interface TimerState {
  status: 'ready' | 'running' | 'judging' | 'done';
  startedAt: number | null;
  elapsedMs: number | null;
  winner: Outcome | null;
}

export interface TimerView {
  status: TimerState['status'];
  startedAt: number | null;
  /** Only revealed to everyone once the referee has judged. */
  elapsedMs: number | null;
  winner: Outcome | null;
}

export const timerLogic: MinigameLogic<TimerState, TimerView> = {
  info: {
    id: 'timer',
    name: 'Timer',
    rules: 'The Host times a secret stretch. Say out loud how long you think it was. Closest wins.',
    refereeDuty: 'Tap Start, wait a random time (under 30 s), tap Stop. Then pick whoever guessed closest.',
    icon: '⏱️',
    color: '#b18cff',
    category: 'misc',
    scoring: 'referee',
  },
  init() {
    return { status: 'ready', startedAt: null, elapsedMs: null, winner: null };
  },
  onInput(s, role, payload, now) {
    if (role !== 'ref') return s;
    if (payload?.action === 'start' && s.status === 'ready') {
      return { ...s, status: 'running', startedAt: now };
    }
    if (payload?.action === 'stop' && s.status === 'running') {
      // The referee's phone measures the time itself so it matches what they saw.
      const reported = Number(payload.elapsedMs);
      const measured = now - (s.startedAt ?? now);
      const elapsed = Number.isFinite(reported) && reported > 0 ? reported : measured;
      return { ...s, status: 'judging', elapsedMs: Math.min(MAX_MS, Math.round(elapsed)) };
    }
    if (payload?.action === 'judge' && s.status === 'judging' && ['a', 'b', 'draw'].includes(payload.winner)) {
      return { ...s, status: 'done', winner: payload.winner };
    }
    return s;
  },
  tick(s, now) {
    if (s.status === 'running' && s.startedAt !== null && now - s.startedAt >= MAX_MS + HOST_GRACE_MS) {
      return { ...s, status: 'judging', elapsedMs: MAX_MS };
    }
    return s;
  },
  result(s) {
    return s.status === 'done' ? s.winner : null;
  },
  project(s) {
    return {
      status: s.status,
      startedAt: s.startedAt,
      elapsedMs: s.status === 'done' ? s.elapsedMs : null,
      winner: s.winner,
    };
  },
};
