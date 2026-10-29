import { useEffect, useRef, useState } from 'react';
import { Character } from '../../characters/Character';
import { play } from '../../sound';
import { Countdown } from '../../ui/common';
import type { DuelPeople, MinigameViews } from '../types';
import { findNumberQuestion, formatNumber, parseGuess } from './bank';
import { GUESS_MS, type HigherLowerView } from './logic';

type Side = 'a' | 'b';

const show = (n: number | null, unit: string) => (n === null ? 'No guess' : `${formatNumber(n, unit)}${unit ? ` ${unit}` : ''}`);

/** How far off a guess was, as text ("off by 120 m", "spot on!"). */
function offBy(guess: number | null, answer: number, unit: string) {
  if (guess === null) return 'ran out of time';
  const d = Math.abs(guess - answer);
  if (d < 1e-9) return 'spot on!';
  return `off by ${show(Math.round(d * 1000) / 1000, unit)}`;
}

/** The answer and both guesses on one line, so everyone can see who was closer. */
function NumberLine({ view, people }: { view: HigherLowerView; people: DuelPeople }) {
  const answer = view.answer!;
  const pts = [answer, view.guesses!.a, view.guesses!.b].filter((x): x is number => x !== null);
  let lo = Math.min(...pts);
  let hi = Math.max(...pts);
  if (hi === lo) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.08;
  const at = (n: number) => `${((n - lo + pad) / (hi - lo + pad * 2)) * 100}%`;
  return (
    <div className="hl-line">
      <div className="hl-track" />
      {(['a', 'b'] as Side[]).map((s) => {
        const g = view.guesses![s];
        if (g === null) return null;
        return (
          <div key={s} className={`hl-mark guess ${s}`} style={{ left: at(g), background: people[s].color }} title={people[s].name}>
            <span>{people[s].name}</span>
          </div>
        );
      })}
      {/* Gold, like the answer box above it. */}
      <div className="hl-mark answer" style={{ left: at(answer) }} title="Answer" />
    </div>
  );
}

export const higherLowerViews: MinigameViews<HigherLowerView> = {
  HostView({ view, people, now }) {
    const last = useRef(view.status);
    useEffect(() => {
      if (view.status === 'reveal' && last.current === 'guessing') play('reveal');
      last.current = view.status;
    }, [view.status]);

    const shown = view.status !== 'guessing';
    const side = (s: Side) => {
      const won = shown && view.winner === s;
      const lost = shown && view.winner !== s && view.winner !== 'draw';
      return (
        <div className={`rps-side${won ? ' won' : ''}`}>
          <Character
            color={people[s].color}
            accessory={people[s].accessory}
            size={100}
            flip={s === 'b'}
            pose={won ? 'win' : lost ? 'lose' : 'idle'}
          />
          <div className="big-name">{people[s].name}</div>
          <div className="hl-guess">
            {shown ? (
              <>
                <b>{show(view.guesses![s], view.unit)}</b>
                <small>{offBy(view.guesses![s], view.answer!, view.unit)}</small>
              </>
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
      <div className="hl-host">
        <div className="trivia-card">{view.question}</div>
        <div className="hl-middle">
          {side('a')}
          <div className="hl-center">
            {shown ? (
              <div className="trivia-answer shown">
                <small>Answer</small> {show(view.answer, view.unit)}
              </div>
            ) : (
              <Countdown endsAt={view.guessEndsAt} now={now} total={GUESS_MS} size={110} />
            )}
            <h2 className="trivia-call">
              {!shown && 'Type your guess on your phone!'}
              {shown &&
                (view.winner === 'draw'
                  ? 'Exactly as close: it’s a draw!'
                  : `${people[view.winner as Side].name} was closest!`)}
            </h2>
          </div>
          {side('b')}
        </div>
        {shown && <NumberLine view={view} people={people} />}
      </div>
    );
  },

  DuelistView({ view, side, people, send, now }) {
    const other: Side = side === 'a' ? 'b' : 'a';
    const [text, setText] = useState('');
    // What this phone sent, so it can be shown while waiting (the host hides guesses until the reveal).
    const [sent, setSent] = useState<{ q: string; value: number } | null>(null);
    const mine = sent && sent.q === view.questionId ? sent.value : null;

    if (view.status !== 'guessing') {
      const res = view.winner === 'draw' ? 'It’s a draw!' : view.winner === side ? 'You were closest! 🎉' : `${people[other].name} was closer 😵`;
      return (
        <div className="phone-center">
          <div className="phone-big">{res}</div>
          <p>
            Answer: <b>{show(view.answer, view.unit)}</b>
          </p>
          <p>
            You: {show(view.guesses![side], view.unit)} ({offBy(view.guesses![side], view.answer!, view.unit)})
            <br />
            {people[other].name}: {show(view.guesses![other], view.unit)}
          </p>
        </div>
      );
    }
    if (view.locked[side]) {
      return (
        <div className="phone-center">
          <p className="trivia-phone-q">{view.question}</p>
          <div className="phone-big">{mine !== null ? show(mine, view.unit) : 'Locked in'}</div>
          <p>{view.locked[other] ? 'Revealing…' : `Waiting for ${people[other].name}…`}</p>
        </div>
      );
    }
    const value = parseGuess(text);
    const submit = () => {
      if (value === null) return;
      setSent({ q: view.questionId, value });
      send({ action: 'guess', value });
    };
    // Number pads on phones often have no minus key, so there's a button for it.
    const flip = () => setText((t) => (t.trim().startsWith('-') ? t.trim().slice(1) : `-${t.trim()}`));
    return (
      <div className="phone-center">
        <div className="phone-row">
          <span>Your guess</span>
          <Countdown endsAt={view.guessEndsAt} now={now} total={GUESS_MS} size={56} />
        </div>
        <p className="trivia-phone-q">{view.question}</p>
        <form
          className="hl-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="hl-input-row">
            <button type="button" className="btn hl-sign" onClick={flip} aria-label="Make negative or positive">
              ±
            </button>
            <input
              className="hl-input"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 16))}
              aria-label="Your guess"
            />
            {view.unit && <span className="hl-unit">{view.unit}</span>}
          </div>
          <button className="btn btn-primary btn-huge" disabled={value === null}>
            Lock in
          </button>
        </form>
        <p className="muted">You can’t change it once it’s locked in.</p>
      </div>
    );
  },

  RefereeView({ view, people }) {
    // The answer isn't sent to phones until the reveal, so the Host's phone looks it up itself.
    const q = findNumberQuestion(view.questionId);
    const answer = view.answer ?? q?.answer ?? null;
    return (
      <div className="phone-center">
        <p className="trivia-phone-q">{view.question}</p>
        <div className="trivia-secret">
          <small>Answer {view.answer === null ? '(keep it secret!)' : ''}</small>
          {answer === null ? '(not found)' : show(answer, view.unit)}
        </div>
        {q?.source && <p className="muted">Source: {q.source}</p>}
        {view.status === 'guessing' ? (
          <p>
            {people.a.name}: {view.locked.a ? 'locked in ✓' : 'thinking…'}
            <br />
            {people.b.name}: {view.locked.b ? 'locked in ✓' : 'thinking…'}
          </p>
        ) : (
          <p>
            {people.a.name}: {show(view.guesses!.a, view.unit)}
            <br />
            {people.b.name}: {show(view.guesses!.b, view.unit)}
            <br />
            <b>{view.winner === 'draw' ? 'Draw!' : `${people[view.winner as Side].name} was closest.`}</b>
          </p>
        )}
      </div>
    );
  },
};
