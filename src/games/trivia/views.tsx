import { useEffect, useRef } from 'react';
import { play } from '../../sound';
import type { MinigameViews } from '../types';
import { findQuestion } from './bank';
import type { TriviaView } from './logic';
import { Contestant } from './Podium';

export const triviaViews: MinigameViews<TriviaView> = {
  HostView({ view, people }) {
    // Buzz sound on the big screen the moment someone buzzes.
    const last = useRef(view.status);
    useEffect(() => {
      if (view.status === 'buzzed' && last.current === 'open') play('buzz');
      if (view.status === 'done' && last.current !== 'done') play(view.correct ? 'reveal' : 'lose');
      last.current = view.status;
    }, [view.status, view.correct]);

    const buzzer = view.buzzer ? people[view.buzzer] : null;
    const contestant = (s: 'a' | 'b') => (
      <Contestant
        people={people}
        side={s}
        lit={view.buzzer === s}
        won={view.status === 'done' && view.winner === s}
        done={view.status === 'done'}
      />
    );
    return (
      <div className="trivia-host">
        {contestant('a')}
        <div className="trivia-middle">
          <div className="trivia-number">Question {view.number}</div>
          <div className="trivia-card">{view.question}</div>
          <div className={`trivia-answer${view.answer ? ' shown' : ''}`}>
            {view.answer ? (
              <>
                <small>Answer</small> {view.answer}
              </>
            ) : (
              '?'
            )}
          </div>
          <h2 className="trivia-call">
            {view.status === 'open' && 'Buzz in on your phone!'}
            {view.status === 'buzzed' && `${buzzer!.name}, say your answer out loud!`}
            {view.status === 'revealed' && `Was ${buzzer!.name} right? The Host decides…`}
            {view.status === 'nobody' && 'Nobody got it! Next question coming up…'}
            {view.status === 'done' &&
              (view.correct
                ? `Correct! ${people[view.winner as 'a' | 'b'].name} wins!`
                : `Wrong! ${people[view.winner as 'a' | 'b'].name} wins!`)}
          </h2>
        </div>
        {contestant('b')}
      </div>
    );
  },

  DuelistView({ view, side, people, send }) {
    const other = side === 'a' ? 'b' : 'a';
    if (view.status === 'open') {
      return (
        <div className="phone-center">
          <p className="trivia-phone-q">{view.question}</p>
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
          <p>Answer: {view.answer}</p>
        </div>
      );
    }
    if (view.status === 'nobody') {
      return (
        <div className="phone-center">
          <div className="phone-big">Nobody got it</div>
          <p>Answer: {view.answer}</p>
          <p className="muted">Get ready for the next question…</p>
        </div>
      );
    }
    const mine = view.buzzer === side;
    return (
      <div className="phone-center">
        <div className="phone-big">{mine ? 'You buzzed! 🔔' : `${people[other].name} buzzed first`}</div>
        <p>{mine ? 'Say your answer out loud.' : 'If they get it wrong, you win!'}</p>
        {view.answer && <p>Answer: {view.answer}</p>}
      </div>
    );
  },

  RefereeView({ view, people, send }) {
    // The answer isn't sent to the phones until it's revealed, so the Host's phone looks it up itself.
    const answer = view.answer ?? findQuestion(view.category, view.questionId)?.answer ?? '(not found)';
    const buzzer = view.buzzer ? people[view.buzzer] : null;
    return (
      <div className="phone-center">
        <p className="trivia-phone-q">{view.question}</p>
        <div className="trivia-secret">
          <small>Answer {view.answer ? '' : '(keep it secret!)'}</small>
          {answer}
        </div>
        {view.status === 'open' && (
          <>
            <p>Waiting for someone to buzz…</p>
            <button className="btn" onClick={() => send({ action: 'nobody' })}>
              Nobody knows it
            </button>
          </>
        )}
        {view.status === 'buzzed' && (
          <>
            <p>
              <b>{buzzer!.name}</b> buzzed! Listen to their answer.
            </p>
            <button className="btn btn-primary btn-huge" onClick={() => send({ action: 'reveal' })}>
              Reveal answer
            </button>
          </>
        )}
        {view.status === 'revealed' && (
          <>
            <p>
              Was <b>{buzzer!.name}</b> right?
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
        {view.status === 'nobody' && (
          <button className="btn btn-primary btn-huge" onClick={() => send({ action: 'next' })}>
            Next question
          </button>
        )}
        {view.status === 'done' && <p>{view.correct ? 'Marked correct.' : 'Marked wrong.'}</p>}
      </div>
    );
  },
};
