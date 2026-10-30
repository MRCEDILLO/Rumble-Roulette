import { useEffect, useRef } from 'react';
import { play } from '../../sound';
import { Contestant } from '../trivia/Podium';
import type { DuelPeople, MinigameViews, PhoneViewProps } from '../types';
import { formatNumber, type WhatsMyNumberView } from './logic';

/** Said wherever players need reminding what numbers can come up. */
const RANGE = '1 to a million, and big ones are always round (like 250 or 5,000)';

type Side = 'a' | 'b';
const SIDES: Side[] = ['a', 'b'];

/** One number card (same look as Celebrity Heads). Face down shows only a "?", so duelists can't read it off the big screen. */
function Card({ view, side, people, faceUp, small }: { view: WhatsMyNumberView; side: Side; people: DuelPeople; faceUp: boolean; small?: boolean }) {
  return (
    <div className={`ch-card${faceUp ? ' face-up' : ''}${small ? ' small' : ''}${view.winner === side ? ' won' : ''}`}>
      <small>{people[side].name}’s number</small>
      {faceUp ? <Num n={view.numbers[side]} /> : <b className="ch-hidden">?</b>}
    </div>
  );
}

function Cards(props: { view: WhatsMyNumberView; people: DuelPeople; faceUp: boolean; small?: boolean }) {
  return (
    <div className={`ch-cards${props.small ? ' small' : ''}`}>
      {SIDES.map((s) => (
        <Card key={s} side={s} {...props} />
      ))}
    </div>
  );
}

/** The number itself, smaller the more digits it has so a million still fits on the card. */
function Num({ n }: { n: number }) {
  const text = formatNumber(n);
  return <b className={`wmn-number${text.length > 7 ? ' xlong' : text.length > 4 ? ' long' : ''}`}>{text}</b>;
}

/** The one twist on Celebrity Heads, shown wherever people are asking or answering. */
function Rule({ small }: { small?: boolean }) {
  return (
    <div className={`wmn-rule${small ? ' small' : ''}`}>
      <b>Subjective yes or no questions only!</b>
      <span>✓ “If I slept this many hours, would it be normal?”</span>
      <span className="muted">✗ “Is it over 50?”</span>
    </div>
  );
}

/** Who to tap for, once someone guesses. */
function GuessedButtons({ people, send }: { people: DuelPeople; send: PhoneViewProps['send'] }) {
  return (
    <>
      <p>When a player says their exact number, tap their name. <span className="muted">Close guesses are your call.</span></p>
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

const shown = (view: WhatsMyNumberView) => view.status === 'reveal' || view.status === 'done';

export const whatsMyNumberViews: MinigameViews<WhatsMyNumberView> = {
  HostView({ view, people }) {
    const last = useRef(view.status);
    useEffect(() => {
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
          {/* The duelists can see this screen, so the numbers stay face down until someone guesses. */}
          <Cards view={view} people={people} faceUp={done} />
          <h2 className="trivia-call">
            {view.status === 'asking' && `${people[view.first].name} asks first!`}
            {done && `${winner!.name} guessed it!`}
          </h2>
          {view.status === 'asking' && (
            <>
              <p className="fl-redraw">Numbers go from {RANGE}.</p>
              <Rule />
              <p className="fl-redraw">Everyone else: check your phone and answer out loud. No giving it away!</p>
            </>
          )}
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
          <p>Your number was</p>
          <div className="ch-card face-up ch-you">
            <Num n={view.numbers[side]} />
          </div>
        </div>
      );
    }
    return (
      <div className="phone-center">
        <div className="ch-mystery">?</div>
        <div className="phone-big">What’s your number?</div>
        <p>
          It’s from {RANGE}. Take turns asking the room.{' '}
          <b>{view.first === side ? 'You ask first!' : `${people[other].name} asks first.`}</b>
        </p>
        <Rule small />
        <p className="muted">Think you know? Say your number out loud.</p>
      </div>
    );
  },

  RefereeView({ view, people, send }) {
    return (
      <div className="phone-center">
        {view.status === 'asking' && <p>Keep your screen hidden from the players!</p>}
        <Cards view={view} people={people} faceUp small />
        {view.status === 'asking' && (
          <>
            <Rule small />
            <GuessedButtons people={people} send={send} />
          </>
        )}
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
        {view.status === 'asking' && <p className="muted">Answer their questions out loud: yes or no. Go with your gut!</p>}
      </div>
    );
  },
};
