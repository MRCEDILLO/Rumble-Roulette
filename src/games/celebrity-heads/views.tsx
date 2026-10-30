import { useEffect, useRef } from 'react';
import { play } from '../../sound';
import { Contestant } from '../trivia/Podium';
import type { DuelPeople, MinigameViews, PhoneViewProps } from '../types';
import type { CelebrityHeadsView } from './logic';

type Side = 'a' | 'b';
const SIDES: Side[] = ['a', 'b'];

/** One character card. Face down shows only a "?", so duelists can't read it off the big screen. */
function Card({ view, side, people, faceUp, small }: { view: CelebrityHeadsView; side: Side; people: DuelPeople; faceUp: boolean; small?: boolean }) {
  const c = view.characters[side];
  return (
    <div className={`ch-card${faceUp ? ' face-up' : ''}${small ? ' small' : ''}${view.winner === side ? ' won' : ''}`}>
      <small>{people[side].name}’s character</small>
      {faceUp ? (
        <>
          <b>{c.name}</b>
          <span className="ch-known">
            {c.real ? 'Real person' : 'Fictional'} · {c.knownFor}
          </span>
        </>
      ) : (
        <b className="ch-hidden">?</b>
      )}
    </div>
  );
}

function Cards(props: { view: CelebrityHeadsView; people: DuelPeople; faceUp: boolean; small?: boolean }) {
  return (
    <div className={`ch-cards${props.small ? ' small' : ''}`}>
      {SIDES.map((s) => (
        <Card key={s} side={s} {...props} />
      ))}
    </div>
  );
}

/** Who to tap for, once someone guesses. */
function GuessedButtons({ people, send }: { people: DuelPeople; send: PhoneViewProps['send'] }) {
  return (
    <>
      <p>
        When a player says their character, tap their name. <span className="muted">Close guesses are your call.</span>
      </p>
      <div className="judge-buttons">
        {SIDES.map((s) => (
          <button key={s} className="btn btn-good judge" onClick={() => send({ action: 'guessed', side: s })}>
            {people[s].name} got it ✓
          </button>
        ))}
      </div>
    </>
  );
}

const shown = (view: CelebrityHeadsView) => view.status === 'reveal' || view.status === 'done';

export const celebrityHeadsViews: MinigameViews<CelebrityHeadsView> = {
  HostView({ view, people }) {
    const last = useRef(view.status);
    useEffect(() => {
      if (view.status === 'asking' && last.current === 'drawing') play('reveal');
      if (view.status === 'reveal' && last.current !== 'reveal') play('reveal');
      last.current = view.status;
    }, [view.status]);

    const done = shown(view);
    const winner = view.winner === 'a' || view.winner === 'b' ? people[view.winner] : null;
    const contestant = (s: Side) => <Contestant people={people} side={s} lit={false} won={done && view.winner === s} done={done} />;
    return (
      <div className="trivia-host">
        {contestant('a')}
        <div className="trivia-middle">
          {/* The duelists can see this screen, so the characters stay face down until someone guesses. */}
          <Cards view={view} people={people} faceUp={done} />
          <h2 className="trivia-call">
            {view.status === 'drawing' && `${people.ref?.name ?? 'The Host'} is checking the characters…`}
            {view.status === 'asking' && `Take turns asking the room yes or no questions. ${people[view.first].name} asks first!`}
            {done && `${winner!.name} guessed it!`}
          </h2>
          {view.status === 'asking' && <p className="fl-redraw">Everyone else: check your phone and answer out loud. No giving it away!</p>}
        </div>
        {contestant('b')}
      </div>
    );
  },

  DuelistView({ view, side, people }) {
    const other = side === 'a' ? 'b' : 'a';
    if (shown(view)) {
      return (
        <div className="phone-center">
          <div className="phone-big">{view.winner === side ? 'You got it! 🎉' : `${people[other].name} got theirs 😵`}</div>
          <p>You were</p>
          <div className="ch-card face-up ch-you">
            <b>{view.characters[side].name}</b>
          </div>
        </div>
      );
    }
    return (
      <div className="phone-center">
        <div className="ch-mystery">?</div>
        <div className="phone-big">Who are you?</div>
        {view.status === 'drawing' ? (
          <p className="muted">The Host is picking your character. No peeking at anyone’s phone!</p>
        ) : (
          <>
            <p>
              Take turns asking the room yes or no questions.{' '}
              <b>{view.first === side ? 'You ask first!' : `${people[other].name} asks first.`}</b>
            </p>
            <p className="muted">Think you know? Say your guess out loud.</p>
          </>
        )}
      </div>
    );
  },

  RefereeView({ view, people, send }) {
    if (view.status === 'drawing') {
      return (
        <div className="phone-center">
          <p>Keep your screen hidden from the players! Redraw anyone the room won’t know.</p>
          <div className="ch-cards small">
            {SIDES.map((s) => (
              <div key={s} className="ch-redraw">
                <Card view={view} side={s} people={people} faceUp small />
                <button className="btn" onClick={() => send({ action: 'redraw', side: s })}>
                  Redraw ↻
                </button>
              </div>
            ))}
          </div>
          <button className="btn btn-primary btn-huge" onClick={() => send({ action: 'begin' })}>
            Start asking
          </button>
        </div>
      );
    }
    return (
      <div className="phone-center">
        <Cards view={view} people={people} faceUp small />
        {view.status === 'asking' && <GuessedButtons people={people} send={send} />}
        {shown(view) && <p>Marked: {people[view.winner as Side].name} guessed it.</p>}
      </div>
    );
  },

  AudienceView({ view, people }) {
    return (
      <div className="phone-center">
        <p>
          <b>Top secret!</b> Don’t let {people.a.name} or {people.b.name} see your screen.
        </p>
        <Cards view={view} people={people} faceUp small />
        {view.status === 'drawing' && <p className="muted">The Host might still redraw these.</p>}
        {view.status === 'asking' && <p className="muted">Answer their questions out loud: yes or no.</p>}
      </div>
    );
  },
};
