import { useEffect, useRef } from 'react';
import { play } from '../../sound';
import { useTicker } from '../../ui/hooks';
import { Contestant } from '../trivia/Podium';
import type { DuelPeople, MinigameViews } from '../types';
import { CLOCK_MS, other, timeLeft, type ClashView, type Side } from './logic';

const SIDES: Side[] = ['a', 'b'];

/** One player's chess clock: tenths of a second and a bar that drains as it runs. */
function Clock({ view, side, now, small }: { view: ClashView; side: Side; now: () => number; small?: boolean }) {
  useTicker(100, view.status === 'running');
  const left = timeLeft(view, side, now());
  const running = view.status === 'running' && view.turn === side;
  const urgent = left <= 5_000;
  return (
    <div className={`cc-clock${running ? ' running' : ''}${urgent ? ' urgent' : ''}${small ? ' small' : ''}`}>
      <span className="cc-time">{(Math.ceil(left / 100) / 10).toFixed(1)}</span>
      <span className="cc-bar">
        <span style={{ width: `${(left / CLOCK_MS) * 100}%` }} />
      </span>
    </div>
  );
}

/** Seconds left to read the category before the clocks start. */
function ReadCountdown({ view, now }: { view: ClashView; now: () => number }) {
  useTicker(200, view.status === 'reading');
  return <>{Math.max(1, Math.ceil((view.readUntil - now()) / 1000))}</>;
}

function callout(view: ClashView, people: DuelPeople, now: () => number) {
  const turn = people[view.turn].name;
  switch (view.status) {
    case 'reading':
      return (
        <>
          {turn} goes first… clocks start in <ReadCountdown view={view} now={now} />
        </>
      );
    case 'running':
      return `${turn}, name one and hit your buzzer!`;
    case 'paused':
      return 'Paused! The Host is checking that answer…';
    default:
      return `${people[other(view.winner as Side)].name} ran out of time! ${people[view.winner as Side].name} wins!`;
  }
}

function useHostSounds(view: ClashView) {
  const last = useRef(view.status);
  const lastTurn = useRef(view.turn);
  useEffect(() => {
    if (view.status === 'running' && last.current === 'reading') play('reveal');
    if (view.status === 'paused') play('drum');
    if (view.status === 'result') play('buzz');
    last.current = view.status;
  }, [view.status]);
  useEffect(() => {
    if (view.status === 'running' && view.turn !== lastTurn.current) play('pop');
    lastTurn.current = view.turn;
  }, [view.turn, view.status]);
}

export const categoryClashViews: MinigameViews<ClashView> = {
  HostView({ view, people, now }) {
    useHostSounds(view);
    const over = view.status === 'result' || view.status === 'done';
    const contestant = (s: Side) => (
      <div className="cc-side">
        <Clock view={view} side={s} now={now} />
        <Contestant
          people={people}
          side={s}
          lit={view.status === 'running' && view.turn === s}
          won={over && view.winner === s}
          done={over}
        />
      </div>
    );
    return (
      <div className="trivia-host cc-host">
        {contestant('a')}
        <div className="trivia-middle">
          <div className="trivia-number">
            {view.number > 1 ? `Category ${view.number}` : 'Category'}
            {view.answers > 0 && ` · ${view.answers} ${view.answers === 1 ? 'answer' : 'answers'}`}
          </div>
          <div className="trivia-card cc-card">{view.category.text}</div>
          <h2 className={`trivia-call${view.status === 'paused' ? ' cc-paused' : ''}`}>{callout(view, people, now)}</h2>
          <p className="muted">No repeats! Say it, then buzz to pass.</p>
        </div>
        {contestant('b')}
      </div>
    );
  },

  DuelistView({ view, side, people, send, now }) {
    const opp = other(side);
    const over = view.status === 'result' || view.status === 'done';
    if (over) {
      return (
        <div className="phone-center">
          <div className="phone-big">{view.winner === side ? 'You win! 🎉' : 'Out of time 😵'}</div>
          <p className="cc-phone-cat">{view.category.text}</p>
        </div>
      );
    }
    const mine = view.turn === side;
    return (
      <div className="phone-center">
        <p className="cc-phone-cat">{view.category.text}</p>
        <div className="cc-phone-clocks">
          <div>
            <small>You</small>
            <Clock view={view} side={side} now={now} small />
          </div>
          <div>
            <small>{people[opp].name}</small>
            <Clock view={view} side={opp} now={now} small />
          </div>
        </div>
        {view.status === 'reading' && (
          <p className="phone-big">
            {mine ? 'You go first!' : `${people[opp].name} goes first`}
            <br />
            <small>
              Starting in <ReadCountdown view={view} now={now} />
            </small>
          </p>
        )}
        {view.status === 'paused' && <p className="phone-big">Paused! The Host is checking…</p>}
        {view.status === 'running' && (
          <>
            <button className={`buzzer${mine ? '' : ' cc-off'}`} disabled={!mine} onClick={() => send({ action: 'pass' })}>
              {mine ? 'PASS' : 'WAIT'}
            </button>
            <p>{mine ? 'Say one out loud, then hit PASS!' : `${people[opp].name}'s turn. Think of your next one!`}</p>
          </>
        )}
      </div>
    );
  },

  RefereeView({ view, people, send, now }) {
    const over = view.status === 'result' || view.status === 'done';
    return (
      <div className="phone-center">
        <p className="cc-phone-cat">{view.category.text}</p>
        <div className="cc-phone-clocks">
          {SIDES.map((s) => (
            <div key={s} className={view.turn === s && !over ? 'cc-turn' : ''}>
              <small>{people[s].name}</small>
              <Clock view={view} side={s} now={now} small />
            </div>
          ))}
        </div>
        {view.status === 'reading' && (
          <>
            <p>
              <b>{people[view.turn].name}</b> goes first. Clocks start in <ReadCountdown view={view} now={now} />.
            </p>
            <button className="btn btn-primary btn-huge" onClick={() => send({ action: 'start' })}>
              Start now
            </button>
            <button className="btn" onClick={() => send({ action: 'redraw' })}>
              New category
            </button>
          </>
        )}
        {view.status === 'running' && (
          <>
            <p>
              <b>{people[view.turn].name}</b>'s turn. Not in the category, or said already? Pause it.
            </p>
            <button className="btn btn-danger btn-huge" onClick={() => send({ action: 'pause' })}>
              Pause
            </button>
          </>
        )}
        {view.status === 'paused' && (
          <>
            <p>Did that answer count?</p>
            <div className="judge-buttons">
              <button className="btn btn-good judge" onClick={() => send({ action: 'play' })}>
                ▶ Play on ✓
              </button>
              {view.lastPass && (
                <button className="btn btn-danger judge" onClick={() => send({ action: 'sendBack' })}>
                  ✗ Back to {people[view.lastPass].name}
                </button>
              )}
            </div>
            <p className="muted">
              {view.lastPass
                ? `Back to ${people[view.lastPass].name} means their last answer didn't count, and their clock runs again.`
                : `Play on restarts ${people[view.turn].name}'s clock.`}
            </p>
          </>
        )}
        {over && <div className="phone-big">{people[view.winner as Side].name} wins!</div>}
      </div>
    );
  },
};
