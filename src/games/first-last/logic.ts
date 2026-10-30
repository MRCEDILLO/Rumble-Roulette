import type { GameContext, GamePerson, MinigameLogic, Outcome } from '../types';

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
/** How long both players get to think before the Host can draw new letters. */
export const REDRAW_MS = 10_000;

/** Who picks a letter. `host` is true when it's the round's Host. */
export interface Picker extends GamePerson {
  host: boolean;
}

export interface FirstLastState {
  /**
   * choosing: two people are picking the letters. open: letters are up, buzzers are live.
   * buzzed: someone buzzed and is saying a word. steal: they got it wrong, the other player answers.
   * missed: both got it wrong, waiting for the Host to draw new letters.
   */
  status: 'choosing' | 'open' | 'buzzed' | 'steal' | 'missed' | 'done';
  ctx: GameContext;
  /** Who picks the first letter and who picks the last one. */
  pickers: [Picker, Picker];
  letters: [string | null, string | null];
  /** When both letters went up (host clock), for the redraw countdown. */
  shownAt: number | null;
  /** Which pair of letters of this duel this is (goes up on each redraw). */
  number: number;
  /** Whoever is answering right now. */
  buzzer: 'a' | 'b' | null;
  /** Who already got these letters wrong. */
  missed: 'a' | 'b' | null;
  winner: Outcome | null;
}

export interface FirstLastView {
  status: FirstLastState['status'];
  pickers: [Picker, Picker];
  /** Each letter stays hidden until both are picked. */
  letters: [string | null, string | null];
  /** Which letters are picked (so phones can show who we're still waiting on). */
  picked: [boolean, boolean];
  shownAt: number | null;
  number: number;
  buzzer: 'a' | 'b' | null;
  missed: 'a' | 'b' | null;
  winner: Outcome | null;
}

/**
 * Who picks the letters. 3 players (no audience): the Host picks both. 4 players: the Host and the
 * one audience member pick one each. 5+: two random audience members.
 */
export function choosePickers(ctx: GameContext, rng: () => number): [Picker, Picker] {
  const host: Picker[] = ctx.ref ? [{ ...ctx.ref, host: true }] : [];
  const audience = ctx.audience.map((p) => ({ ...p, host: false }));
  // Shuffle so it's a different pair (and order) each time.
  for (let i = audience.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [audience[i], audience[j]] = [audience[j], audience[i]];
  }
  const pool = audience.length >= 2 ? audience : [...host, ...audience];
  if (pool.length === 0) throw new Error('First and Last needs a Host');
  if (pool.length === 1) return [pool[0], pool[0]];
  const pair: [Picker, Picker] = [pool[0], pool[1]];
  return rng() < 0.5 ? pair : [pair[1], pair[0]];
}

const NOBODY: GameContext = { ref: { id: 'ref', name: 'Host' }, audience: [] };

function draw(ctx: GameContext, rng: () => number, number: number): FirstLastState {
  return {
    status: 'choosing',
    ctx,
    pickers: choosePickers(ctx, rng),
    letters: [null, null],
    shownAt: null,
    number,
    buzzer: null,
    missed: null,
    winner: null,
  };
}

export const firstLastLogic: MinigameLogic<FirstLastState, FirstLastView> = {
  info: {
    id: 'first-last',
    name: 'First and Last',
    rules:
      'Two letters go up on the big screen. Buzz in and say a word that starts with the first letter and ends with the last. Wrong: the other player gets a go.',
    refereeDuty:
      'Pick a letter if it’s your turn. When someone buzzes, listen to their word and mark it right or wrong. If nobody can think of one, draw new letters after 10 seconds.',
    icon: '🔤',
    color: '#ffb347',
    category: 'word',
    scoring: 'referee',
  },
  init(_now, rng, ctx) {
    return draw(ctx ?? NOBODY, rng, 1);
  },
  onInput(s, role, payload, now, rng, seat) {
    const action = payload?.action;

    if (s.status === 'choosing' && action === 'letter') {
      const letter = String(payload.letter ?? '').toUpperCase();
      const slot = payload.slot;
      if (!LETTERS.includes(letter) || (slot !== 0 && slot !== 1) || s.letters[slot] !== null) return s;
      const picker = s.pickers[slot];
      // Your own slot, or the Host filling in for someone who isn't picking.
      const mine = picker.host ? role === 'ref' : seat === picker.id && role === 'audience';
      const forThem = role === 'ref' && payload.random === true && !picker.host;
      if (!mine && !forThem) return s;
      const letters: [string | null, string | null] = [...s.letters];
      letters[slot] = forThem ? LETTERS[Math.floor(rng() * LETTERS.length)] : letter;
      const ready = letters[0] !== null && letters[1] !== null;
      return { ...s, letters, status: ready ? 'open' : 'choosing', shownAt: ready ? now : null };
    }

    if ((role === 'a' || role === 'b') && action === 'buzz' && s.status === 'open') {
      // First buzz to reach the host wins.
      return { ...s, status: 'buzzed', buzzer: role };
    }

    if (role !== 'ref') return s;
    if (action === 'judge' && (s.status === 'buzzed' || s.status === 'steal') && typeof payload.correct === 'boolean') {
      if (payload.correct) return { ...s, status: 'done', winner: s.buzzer };
      if (s.status === 'steal') return { ...s, status: 'missed', buzzer: null };
      const other = s.buzzer === 'a' ? 'b' : 'a';
      return { ...s, status: 'steal', missed: s.buzzer, buzzer: other };
    }
    if (action === 'redraw') {
      const waited = s.status === 'open' && s.shownAt !== null && now - s.shownAt >= REDRAW_MS;
      if (waited || s.status === 'missed') return draw(s.ctx, rng, s.number + 1);
    }
    return s;
  },
  result(s) {
    return s.status === 'done' ? s.winner : null;
  },
  project(s) {
    const shown = s.status !== 'choosing';
    return {
      status: s.status,
      pickers: s.pickers,
      letters: shown ? s.letters : [null, null],
      picked: [s.letters[0] !== null, s.letters[1] !== null],
      shownAt: s.shownAt,
      number: s.number,
      buzzer: s.buzzer,
      missed: s.missed,
      winner: s.winner,
    };
  },
};
