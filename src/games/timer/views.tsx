import { useEffect, useRef, useState } from 'react';
import { Character } from '../../characters/Character';
import { useTicker } from '../../ui/hooks';
import type { MinigameViews } from '../types';
import { MAX_MS, type TimerView } from './logic';

const fmt = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

function Status({ view }: { view: TimerView }) {
  switch (view.status) {
    case 'ready':
      return <>Referee, get ready to start the timer…</>;
    case 'running':
      return <>Timing… count in your head!</>;
    case 'judging':
      return <>Say your guesses out loud! The referee will pick the closest.</>;
    case 'done':
      return <>The time was</>;
  }
}

export const timerViews: MinigameViews<TimerView> = {
  HostView({ view, people }) {
    const done = view.status === 'done';
    return (
      <div className="timer-host">
        <h2 className="timer-status">
          <Status view={view} />
        </h2>
        <div className={`timer-clock ${view.status}`}>
          {done && view.elapsedMs !== null ? fmt(view.elapsedMs) : view.status === 'running' ? '⏱️' : '?'}
        </div>
        <div className="rps-arena">
          {(['a', 'b'] as const).map((s) => (
            <div key={s} className={`rps-side${done && view.winner === s ? ' won' : ''}`}>
              <Character
                color={people[s].color}
                accessory={people[s].accessory}
                size={130}
                flip={s === 'b'}
                pose={done && view.winner === s ? 'win' : 'idle'}
              />
              <div className="big-name">{people[s].name}</div>
            </div>
          ))}
        </div>
        {done && <h2>{view.winner === 'draw' ? 'Too close to call: draw!' : `${people[view.winner!].name} was closest!`}</h2>}
      </div>
    );
  },

  DuelistView({ view }) {
    return (
      <div className="phone-center">
        <div className={`timer-clock small ${view.status}`}>{view.status === 'running' ? '⏱️' : '🤔'}</div>
        <div className="phone-big">
          <Status view={view} />
        </div>
        {view.status === 'done' && view.elapsedMs !== null && <div className="phone-big">{fmt(view.elapsedMs)}</div>}
      </div>
    );
  },

  RefereeView({ view, people, send }) {
    // The referee's phone times it, so the number matches what they saw.
    const key = `rr-timer-${view.startedAt ?? 'none'}`;
    const startRef = useRef<number | null>(null);
    const [elapsed, setElapsed] = useState<number | null>(() => {
      const saved = sessionStorage.getItem(key);
      return saved ? Number(saved) : null;
    });
    const running = view.status === 'running' && startRef.current !== null;
    useTicker(100, running);

    const stop = () => {
      if (startRef.current === null) return;
      const ms = Math.min(MAX_MS, Math.round(performance.now() - startRef.current));
      startRef.current = null;
      setElapsed(ms);
      sessionStorage.setItem(`rr-timer-${view.startedAt}`, String(ms));
      send({ action: 'stop', elapsedMs: ms });
    };

    useEffect(() => {
      if (view.status === 'ready') {
        startRef.current = null;
        setElapsed(null);
      }
    }, [view.status]);

    // Safety net: stop automatically at 30 seconds.
    useEffect(() => {
      if (running && performance.now() - startRef.current! >= MAX_MS) stop();
    });

    if (view.status === 'ready') {
      return (
        <div className="phone-center">
          <p>Tap Start, wait a random amount of time (under 30 s), then tap Stop. Don't let them see your screen!</p>
          <button
            className="btn btn-primary btn-huge"
            onClick={() => {
              startRef.current = performance.now();
              send({ action: 'start' });
            }}
          >
            Start ▶
          </button>
        </div>
      );
    }
    if (view.status === 'running') {
      return (
        <div className="phone-center">
          <p>Timing… stop whenever you like.</p>
          <button className="btn btn-danger btn-huge" onClick={stop} disabled={startRef.current === null}>
            Stop ■
          </button>
          {startRef.current === null && <p className="muted">Waiting for the timer to start…</p>}
        </div>
      );
    }
    if (view.status === 'judging') {
      return (
        <div className="phone-center">
          <div className="muted">The real time was</div>
          <div className="timer-secret">{elapsed !== null ? fmt(elapsed) : 'unknown (phone refreshed)'}</div>
          <p>Listen to their guesses. Who was closest?</p>
          <div className="judge-buttons">
            {(['a', 'b'] as const).map((s) => (
              <button key={s} className="btn btn-primary judge" onClick={() => send({ action: 'judge', winner: s })}>
                <Character color={people[s].color} accessory={people[s].accessory} size={44} pose="still" />
                {people[s].name}
              </button>
            ))}
            <button className="btn" onClick={() => send({ action: 'judge', winner: 'draw' })}>
              Draw
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="phone-center">
        <div className="phone-big">{view.elapsedMs !== null ? fmt(view.elapsedMs) : ''}</div>
      </div>
    );
  },
};
