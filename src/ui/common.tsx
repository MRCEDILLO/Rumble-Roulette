import { Character, type Pose } from '../characters/Character';
import { allowedActions } from '../engine/engine';
import type { Look, PublicState, RefAction, SeatId } from '../engine/types';
import type { DuelPeople } from '../games/types';
import { useTicker } from './hooks';

export function Countdown({ endsAt, now, total, size = 80 }: { endsAt: number; now: () => number; total: number; size?: number }) {
  useTicker(100);
  const left = Math.max(0, endsAt - now());
  const secs = Math.ceil(left / 1000);
  const frac = Math.min(1, left / total);
  const r = 42;
  const circ = 2 * Math.PI * r;
  return (
    <div className={`countdown${secs <= 5 ? ' urgent' : ''}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <circle cx="50" cy="50" r={r} className="countdown-track" />
        <circle
          cx="50"
          cy="50"
          r={r}
          className="countdown-fill"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - frac)}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <span>{secs}</span>
    </div>
  );
}

export function PlayerTag({
  look,
  size = 56,
  pose = 'idle',
  coins,
  sub,
  flip,
  dim,
}: {
  look: Look;
  size?: number;
  pose?: Pose;
  coins?: number;
  sub?: string;
  flip?: boolean;
  dim?: boolean;
}) {
  return (
    <div className={`player-tag${dim ? ' dim' : ''}`}>
      <Character color={look.color} accessory={look.accessory} size={size} pose={pose} flip={flip} />
      <div className="player-tag-name">{look.name}</div>
      {coins !== undefined && <div className="coins">🪙 {coins}</div>}
      {sub && <div className="player-tag-sub">{sub}</div>}
    </div>
  );
}

const ACTION_LABEL: Record<RefAction, string> = {
  next: 'Next round ▶',
  redo: 'Redo game ↺',
  skipGame: 'Skip game (re-spin)',
  skipRound: 'Skip round',
};

export function nextLabel(pub: PublicState) {
  const d = pub.duel;
  if (!d) return ACTION_LABEL.next;
  if (d.kind === 'final') return 'Show the results 🏆';
  if (d.kind === 'free') return 'Back to menu';
  if (d.kind === 'tiebreak') return 'Continue ▶';
  return pub.roundsPlayed >= pub.totalRounds ? 'On to the final ▶' : ACTION_LABEL.next;
}

export function RefControls({ pub, onAction, compact }: { pub: PublicState; onAction: (a: RefAction) => void; compact?: boolean }) {
  const actions = allowedActions(pub);
  if (!actions.length) return null;
  return (
    <div className={`ref-controls${compact ? ' compact' : ''}`}>
      {actions.map((a) => (
        <button
          key={a}
          className={a === 'next' ? 'btn btn-primary' : a === 'redo' ? 'btn' : 'btn btn-quiet'}
          onClick={() => {
            if ((a === 'skipRound' || a === 'skipGame') && !compact && !confirm(`${ACTION_LABEL[a]}?`)) return;
            onAction(a);
          }}
        >
          {a === 'next' ? nextLabel(pub) : ACTION_LABEL[a]}
        </button>
      ))}
    </div>
  );
}

export function duelTitle(pub: PublicState) {
  const d = pub.duel;
  if (!d) return '';
  if (d.kind === 'final') return 'THE FINAL';
  if (d.kind === 'tiebreak') return 'TIE-BREAK';
  if (d.kind === 'free') return 'FREE PLAY';
  const paid = pub.phase === 'result' && d.winner !== null && d.winner !== 'draw';
  return `ROUND ${paid ? pub.roundsPlayed : pub.roundsPlayed + 1} / ${pub.totalRounds}`;
}

export function signed(n: number) {
  return n > 0 ? `+${n}` : `${n}`;
}

export function peopleOf(pub: PublicState): DuelPeople | null {
  const d = pub.duel;
  if (!d) return null;
  const look = (id: SeatId | null) => {
    const s = id ? pub.seats[id] : null;
    return s ? { name: s.name, color: s.color, accessory: s.accessory } : { name: '?', color: 'white', accessory: 'none' };
  };
  return { a: look(d.a), b: look(d.b), ref: d.ref ? look(d.ref) : null };
}
