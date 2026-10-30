import { useEffect, useRef } from 'react';
import { play } from '../../sound';
import { useTicker } from '../../ui/hooks';
import { Contestant } from '../trivia/Podium';
import type { DuelPeople, MinigameViews, PhoneViewProps } from '../types';
import { LETTERS, REDRAW_MS, type FirstLastView } from './logic';

const SLOT_NAMES = ['first', 'last'] as const;

/** Seconds until the Host can draw new letters (0 once they can). */
function useRedrawWait(view: FirstLastView, now: () => number) {
  const counting = view.status === 'open' && view.shownAt !== null;
  useTicker(250, counting);
  if (!counting) return 0;
  return Math.max(0, Math.ceil((view.shownAt! + REDRAW_MS - now()) / 1000));
}

/** The two letter tiles: "F … T". */
function Letters({ view, small }: { view: FirstLastView; small?: boolean }) {
  return (
    <div className={`fl-letters${small ? ' small' : ''}`}>
      {[0, 1].map((i) => (
        <div key={i} className="fl-slot">
          <div className={`fl-tile${view.letters[i] ? ' shown' : view.picked[i] ? ' picked' : ''}`}>
            {view.letters[i] ?? (view.picked[i] ? '✓' : '?')}
          </div>
          <small>
            {SLOT_NAMES[i]} letter
            {!small && view.status === 'choosing' && (
              <>
                <br />
                <b>{view.pickers[i].name}</b>
              </>
            )}
          </small>
        </div>
      ))}
    </div>
  );
}

/** A–Z buttons for picking a letter. */
function LetterGrid({ slot, send }: { slot: 0 | 1; send: PhoneViewProps['send'] }) {
  return (
    <>
      <div className="phone-big">Pick the {SLOT_NAMES[slot]} letter</div>
      <p className="muted">
        The word has to {slot === 0 ? 'start' : 'end'} with it. Easy or hard: your call!
      </p>
      <div className="fl-grid">
        {LETTERS.map((l) => (
          <button key={l} className="btn fl-key" onClick={() => send({ action: 'letter', slot, letter: l })}>
            {l}
          </button>
        ))}
      </div>
    </>
  );
}

/** Who we're still waiting on to pick a letter. */
function waitingOn(view: FirstLastView, exceptHost = false) {
  const names = [0, 1]
    .filter((i) => !view.picked[i] && !(exceptHost && view.pickers[i].host))
    .map((i) => (view.pickers[i].host ? 'the Host' : view.pickers[i].name));
  return [...new Set(names)].join(' and ');
}

const pattern = (view: FirstLastView) => `${view.letters[0]} … ${view.letters[1]}`;

function answering(view: FirstLastView, people: DuelPeople) {
  return view.buzzer ? people[view.buzzer] : null;
}

export const firstLastViews: MinigameViews<FirstLastView> = {
  HostView({ view, people, now }) {
    // Same sounds as trivia: a buzz when someone buzzes, then right or wrong.
    const last = useRef(view.status);
    useEffect(() => {
      if (view.status === 'buzzed' && last.current === 'open') play('buzz');
      if (view.status === 'open' && last.current === 'choosing') play('reveal');
      if ((view.status === 'steal' || view.status === 'missed') && last.current !== view.status) play('lose');
      if (view.status === 'done' && last.current !== 'done') play('reveal');
      last.current = view.status;
    }, [view.status]);
    const wait = useRedrawWait(view, now);

    const buzzer = answering(view, people);
    const done = view.status === 'done';
    const contestant = (s: 'a' | 'b') => (
      <Contestant people={people} side={s} lit={view.buzzer === s} won={done && view.winner === s} done={done} />
    );
    const hostPicksBoth = view.pickers[0].id === view.pickers[1].id;
    return (
      <div className="trivia-host">
        {contestant('a')}
        <div className="trivia-middle">
          <div className="trivia-number">Letters {view.number}</div>
          <Letters view={view} />
          <h2 className="trivia-call">
            {view.status === 'choosing' &&
              (hostPicksBoth
                ? `${view.pickers[0].name}, pick both letters on your phone!`
                : `${waitingOn(view)}: pick a letter on your phone!`)}
            {view.status === 'open' && `Buzz in with a word that starts with ${view.letters[0]} and ends with ${view.letters[1]}!`}
            {view.status === 'buzzed' && `${buzzer!.name}, say your word out loud!`}
            {view.status === 'steal' && `Wrong! ${buzzer!.name}, your turn: say a word!`}
            {view.status === 'missed' && 'Nobody got it! New letters coming up…'}
            {done && `Correct! ${people[view.winner as 'a' | 'b'].name} wins!`}
          </h2>
          {view.status === 'open' && (
            <p className="fl-redraw">{wait > 0 ? `Stuck? The Host can draw new letters in ${wait}…` : 'Stuck? The Host can draw new letters.'}</p>
          )}
        </div>
        {contestant('b')}
      </div>
    );
  },

  DuelistView({ view, side, people, send }) {
    const other = side === 'a' ? 'b' : 'a';
    if (view.status === 'choosing') {
      return (
        <div className="phone-center">
          <div className="phone-big">Letters coming up…</div>
          <Letters view={view} small />
          <p className="muted">Waiting for {waitingOn(view)} to pick.</p>
        </div>
      );
    }
    if (view.status === 'open') {
      return (
        <div className="phone-center">
          <Letters view={view} small />
          <p>Starts with {view.letters[0]}, ends with {view.letters[1]}.</p>
          <button className="buzzer" onClick={() => send({ action: 'buzz' })}>
            BUZZ
          </button>
        </div>
      );
    }
    if (view.status === 'done') {
      return (
        <div className="phone-center">
          <div className="phone-big">{view.winner === side ? 'You win! 🎉' : 'You lose 😵'}</div>
        </div>
      );
    }
    if (view.status === 'missed') {
      return (
        <div className="phone-center">
          <div className="phone-big">Nobody got it</div>
          <p className="muted">Get ready for new letters…</p>
        </div>
      );
    }
    const mine = view.buzzer === side;
    return (
      <div className="phone-center">
        <Letters view={view} small />
        <div className="phone-big">
          {mine ? (view.status === 'steal' ? 'Your turn! 🔔' : 'You buzzed! 🔔') : view.status === 'steal' ? 'You missed 😬' : `${people[other].name} buzzed first`}
        </div>
        <p>
          {mine
            ? `Say a word out loud: starts with ${view.letters[0]}, ends with ${view.letters[1]}.`
            : view.status === 'steal'
              ? `${people[other].name} gets a go. Fingers crossed!`
              : 'If they get it wrong, you get a go!'}
        </p>
      </div>
    );
  },

  RefereeView({ view, people, now, send }) {
    const wait = useRedrawWait(view, now);
    const buzzer = answering(view, people);
    if (view.status === 'choosing') {
      const mine = ([0, 1] as const).find((i) => view.pickers[i].host && !view.picked[i]);
      const theirs = ([0, 1] as const).filter((i) => !view.pickers[i].host && !view.picked[i]);
      return (
        <div className="phone-center">
          {mine !== undefined ? (
            <LetterGrid slot={mine} send={send} />
          ) : (
            <>
              <Letters view={view} small />
              <p>Waiting for {waitingOn(view, true)} to pick…</p>
            </>
          )}
          {theirs.map((i) => (
            <button key={i} className="btn" onClick={() => send({ action: 'letter', slot: i, letter: 'A', random: true })}>
              Pick a random {SLOT_NAMES[i]} letter for {view.pickers[i].name}
            </button>
          ))}
        </div>
      );
    }
    return (
      <div className="phone-center">
        <Letters view={view} small />
        {view.status === 'open' && (
          <>
            <p>Waiting for someone to buzz…</p>
            <button className="btn" disabled={wait > 0} onClick={() => send({ action: 'redraw' })}>
              {wait > 0 ? `Draw new letters (in ${wait})` : 'Draw new letters'}
            </button>
          </>
        )}
        {(view.status === 'buzzed' || view.status === 'steal') && (
          <>
            <p>
              {view.status === 'steal' && 'Their turn to answer! '}Did <b>{buzzer!.name}</b> say a word that starts with{' '}
              <b>{view.letters[0]}</b> and ends with <b>{view.letters[1]}</b>?
            </p>
            <div className="judge-buttons">
              <button className="btn btn-good judge" onClick={() => send({ action: 'judge', correct: true })}>
                Correct ✓
              </button>
              <button className="btn btn-danger judge" onClick={() => send({ action: 'judge', correct: false })}>
                Wrong ✗
              </button>
            </div>
          </>
        )}
        {view.status === 'missed' && (
          <>
            <p>Both players missed.</p>
            <button className="btn btn-primary btn-huge" onClick={() => send({ action: 'redraw' })}>
              Draw new letters
            </button>
          </>
        )}
        {view.status === 'done' && <p>Marked correct.</p>}
      </div>
    );
  },

  AudienceView({ view, seat, send }) {
    if (view.status === 'choosing') {
      const mine = ([0, 1] as const).find((i) => view.pickers[i].id === seat && !view.pickers[i].host && !view.picked[i]);
      if (mine !== undefined) {
        return (
          <div className="phone-center">
            <LetterGrid slot={mine} send={send} />
          </div>
        );
      }
      const picked = view.pickers.some((p, i) => p.id === seat && view.picked[i]);
      return (
        <div className="phone-center">
          <div className="phone-big">{picked ? 'Letter locked in ✓' : 'Letters coming up…'}</div>
          <p className="muted">Waiting for {waitingOn(view)} to pick.</p>
        </div>
      );
    }
    return (
      <div className="phone-center">
        <Letters view={view} small />
        <p>Watch the big screen!</p>
        {view.status === 'open' && <p className="muted">Can you think of one? {pattern(view)}</p>}
      </div>
    );
  },
};
