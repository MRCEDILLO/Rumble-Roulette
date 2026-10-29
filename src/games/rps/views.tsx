import { useState } from 'react';
import { Character } from '../../characters/Character';
import { Countdown } from '../../ui/common';
import type { MinigameViews } from '../types';
import { THROW_MS, WINS_NEEDED, type RpsView, type Throw } from './logic';
import { ThrowPicture } from './ThrowPicture';
const NAME: Record<Throw, string> = { rock: 'Rock', paper: 'Paper', scissors: 'Scissors' };

function Pips({ wins }: { wins: number }) {
  return (
    <div className="pips">
      {Array.from({ length: WINS_NEEDED }, (_, i) => (
        <span key={i} className={i < wins ? 'pip on' : 'pip'} />
      ))}
    </div>
  );
}

export const rpsViews: MinigameViews<RpsView> = {
  HostView({ view, people, now }) {
    const r = view.revealing;
    const side = (s: 'a' | 'b') => {
      const p = people[s];
      const won = r && r.winner === s;
      return (
        <div className={`rps-side${won ? ' won' : ''}`}>
          <Character color={p.color} accessory={p.accessory} size={150} flip={s === 'b'} pose={won ? 'win' : 'idle'} />
          <div className="big-name">{p.name}</div>
          <Pips wins={view.scores[s]} />
          <div className="rps-hand">
            {r ? (
              <ThrowPicture pick={r[s]} size={110} className="hand-reveal" />
            ) : view.locked[s] ? (
              <span className="locked">Locked in ✓</span>
            ) : (
              <span className="thinking">Thinking…</span>
            )}
          </div>
        </div>
      );
    };
    return (
      <div className="rps-host">
        <div className="rps-header">
          <h2>Throw {Math.min(view.throwNumber, view.history.length + 1)}</h2>
          {!r && !view.done && <Countdown endsAt={view.throwEndsAt} now={now} total={THROW_MS} size={90} />}
          {r && <h2 className="rps-call">{r.winner === 'draw' ? 'Tie! Throw again' : `${people[r.winner].name} takes it!`}</h2>}
        </div>
        <div className="rps-arena">
          {side('a')}
          <div className="vs">VS</div>
          {side('b')}
        </div>
        <div className="rps-history">
          {view.history.map((h, i) => (
            <span key={i} className="chip rps-chip">
              <ThrowPicture pick={h.a} size={30} /> vs <ThrowPicture pick={h.b} size={30} />
            </span>
          ))}
        </div>
      </div>
    );
  },

  DuelistView({ view, side, people, send, now }) {
    // Remember what this phone picked so we can show it while waiting.
    const [mine, setMine] = useState<{ n: number; pick: Throw } | null>(null);
    const picked = mine && mine.n === view.throwNumber ? mine.pick : null;
    const r = view.revealing;
    const other = side === 'a' ? 'b' : 'a';
    if (view.done) {
      const won = view.scores[side] > view.scores[other];
      return <div className="phone-big">{won ? 'You win! 🎉' : 'You lose 😵'}</div>;
    }
    if (r) {
      const res = r.winner === 'draw' ? 'Tie!' : r.winner === side ? 'You won that throw!' : `${people[other].name} won that throw`;
      return (
        <div className="phone-center">
          <div className="rps-phone-reveal">
            <ThrowPicture pick={r[side]} size={84} /> <small>vs</small> <ThrowPicture pick={r[other]} size={84} />
          </div>
          <div className="phone-big">{res}</div>
          <div>
            {view.scores[side]} – {view.scores[other]}
          </div>
        </div>
      );
    }
    if (view.locked[side]) {
      return (
        <div className="phone-center">
                    {picked && <ThrowPicture pick={picked} size={110} />}
          <div className="phone-big">{picked ? NAME[picked] : 'Locked in'}</div>
          <p>Waiting for {people[other].name}…</p>
        </div>
      );
    }
    return (
      <div className="phone-center">
        <div className="phone-row">
          <span>
            Throw {view.throwNumber} · {view.scores[side]} – {view.scores[other]}
          </span>
          <Countdown endsAt={view.throwEndsAt} now={now} total={THROW_MS} size={56} />
        </div>
        <div className="rps-buttons">
          {(['rock', 'paper', 'scissors'] as Throw[]).map((t) => (
            <button
              key={t}
              className="rps-btn"
              onClick={() => {
                setMine({ n: view.throwNumber, pick: t });
                send({ pick: t });
              }}
            >
              <ThrowPicture pick={t} size={58} />
              {NAME[t]}
            </button>
          ))}
        </div>
      </div>
    );
  },
};
