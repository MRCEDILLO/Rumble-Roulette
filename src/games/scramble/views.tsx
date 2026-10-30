import { useEffect, useRef, useState } from 'react';
import { Character } from '../../characters/Character';
import { play } from '../../sound';
import { Countdown } from '../../ui/common';
import type { DuelPeople, MinigameViews } from '../types';
import { SOLVE_MS, WORDS, cleanGuess, type ScrambleView } from './logic';

type Side = 'a' | 'b';

const sortLetters = (w: string) => w.split('').sort().join('');

/**
 * The answer, worked out from the jumble. Phones aren't sent it until the word is over, so the
 * Host's phone finds it in the word list (every word in it has no other anagram).
 */
function answerFor(view: ScrambleView) {
  if (view.answer) return view.answer;
  const key = sortLetters(view.letters);
  return WORDS.find((w) => w.text.length === key.length && sortLetters(w.text) === key)?.text ?? null;
}

/** The jumbled letters as tiles, tipped this way and that like they've been tipped out of a bag. */
function Tiles({ letters, small }: { letters: string; small?: boolean }) {
  return (
    <div className={`sc-tiles${small ? ' small' : ''}${letters.length > 7 ? ' long' : ''}`} aria-label={`Letters: ${letters.split('').join(' ')}`}>
      {letters.split('').map((l, i) => (
        <span key={`${letters}-${i}`} className="sc-tile" style={{ '--tilt': `${[-6, 4, -3, 7, -5, 3, -7, 5, -2][i % 9]}deg`, animationDelay: `${i * 50}ms` } as React.CSSProperties}>
          {l}
        </span>
      ))}
    </div>
  );
}

/** Blanks for the answer, with any hint letters (or the whole word once it's over). */
function Slots({ slots, small, missed }: { slots: (string | null)[]; small?: boolean; missed?: boolean }) {
  return (
    <div className={`hm-word${small ? ' small' : ''}${slots.length > 12 ? ' long' : ''}`}>
      {slots.map((l, i) => (
        <span key={i} className={`hm-cell${l ? ' found' : ''}${missed ? ' missed' : ''}`}>
          {l ?? ''}
        </span>
      ))}
    </div>
  );
}

function hintLine(view: ScrambleView) {
  if (view.hints >= 2) return 'Hint: first and last letters';
  if (view.hints === 1) return 'Hint: first letter';
  return `${view.letters.length} letters`;
}

function resultLine(view: ScrambleView, people: DuelPeople, side?: Side) {
  if (view.status === 'missed') return 'Nobody got it! Here comes a new word…';
  const w = view.winner as Side;
  if (side) return w === side ? 'You got it first! 🎉' : `${people[w].name} got it first 😵`;
  return `${people[w].name} unscrambled it!`;
}

const tries = (n: number) => (n === 0 ? 'No wrong guesses' : `${n} wrong ${n === 1 ? 'guess' : 'guesses'}`);

function useHostSounds(view: ScrambleView) {
  const last = useRef(view.status);
  const wrong = view.wrong.a + view.wrong.b;
  const lastWrong = useRef(wrong);
  useEffect(() => {
    if (view.status === 'playing' && last.current !== 'playing') play('reveal');
    if (view.status === 'result') play('fanfare');
    if (view.status === 'missed') play('lose');
    last.current = view.status;
  }, [view.status]);
  useEffect(() => {
    if (view.hints > 0) play('pop');
  }, [view.hints]);
  useEffect(() => {
    if (wrong > lastWrong.current) play('buzz');
    lastWrong.current = wrong;
  }, [wrong]);
}

export const scrambleViews: MinigameViews<ScrambleView> = {
  HostView({ view, people, now }) {
    useHostSounds(view);
    const side = (s: Side) => {
      const won = view.status !== 'playing' && view.winner === s;
      const lost = view.status !== 'playing' && view.winner !== null && view.winner !== s;
      return (
        <div className={`rps-side${won ? ' won' : ''}`}>
          <Character color={people[s].color} accessory={people[s].accessory} size={100} flip={s === 'b'} pose={won ? 'win' : lost ? 'lose' : 'idle'} />
          <div className="big-name">{people[s].name}</div>
          <div className="sc-tries">{won ? 'Got it! ✓' : tries(view.wrong[s])}</div>
        </div>
      );
    };
    return (
      <div className="sc-host">
        <div className="sc-top">
          {view.status === 'playing' && <Countdown endsAt={view.endsAt} now={now} total={SOLVE_MS} size={90} />}
          <h2 className="trivia-call">{view.status === 'playing' ? 'Unscramble it! Type the word on your phone.' : resultLine(view, people)}</h2>
        </div>
        <Tiles letters={view.letters} />
        <Slots slots={view.slots} missed={view.status === 'missed'} />
        <p className="muted sc-hint">
          {view.status === 'playing' ? hintLine(view) : `The word was ${view.answer}`}
          {view.wordNo > 1 && ` · Word ${view.wordNo}`}
        </p>
        <div className="sc-arena">
          {side('a')}
          <div className="vs">VS</div>
          {side('b')}
        </div>
      </div>
    );
  },

  DuelistView({ view, side, people, send, now }) {
    const other: Side = side === 'a' ? 'b' : 'a';
    const [text, setText] = useState('');
    // Whether this phone's last guess was wrong, so it can say so (cleared when you type again).
    const [sentWrong, setSentWrong] = useState(false);
    const lastWrong = useRef(view.wrong[side]);
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
      if (view.wrong[side] > lastWrong.current) {
        setSentWrong(true);
        setText('');
        inputRef.current?.focus();
      }
      lastWrong.current = view.wrong[side];
    }, [view.wrong[side]]);
    // A new word starts with an empty box.
    useEffect(() => {
      setText('');
      setSentWrong(false);
      lastWrong.current = 0;
    }, [view.wordNo]);

    if (view.status !== 'playing') {
      return (
        <div className="phone-center">
          <div className="phone-big">{resultLine(view, people, side)}</div>
          <Tiles letters={view.letters} small />
          <p>The word was</p>
          <Slots slots={view.slots} small missed={view.status === 'missed'} />
        </div>
      );
    }
    const guess = cleanGuess(text);
    return (
      <div className="phone-center">
        <div className="phone-row">
          <span>{hintLine(view)}</span>
          <Countdown endsAt={view.endsAt} now={now} total={SOLVE_MS} size={56} />
        </div>
        <Tiles letters={view.letters} small />
        {view.hints > 0 && <Slots slots={view.slots} small />}
        <form
          className="hl-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (guess) send({ action: 'guess', text: guess });
          }}
        >
          <input
            ref={inputRef}
            className={`hl-input hm-input${sentWrong ? ' sc-wrong' : ''}`}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            maxLength={view.letters.length}
            placeholder={'?'.repeat(view.letters.length)}
            value={text}
            onChange={(e) => {
              setSentWrong(false);
              setText(cleanGuess(e.target.value).slice(0, view.letters.length));
            }}
            aria-label="Your answer"
          />
          {sentWrong && <p className="hm-bad">Not it! Try again.</p>}
          <button className="btn btn-primary btn-huge" disabled={guess.length !== view.letters.length}>
            Go!
          </button>
        </form>
        <p className="muted">
          As many tries as you like. {people[other].name}: {tries(view.wrong[other]).toLowerCase()}
        </p>
      </div>
    );
  },

  RefereeView({ view, people, send }) {
    const answer = answerFor(view);
    return (
      <div className="phone-center">
        <Tiles letters={view.letters} small />
        <div className="trivia-secret">
          <small>Answer {view.status === 'playing' ? '(keep it secret!)' : ''}</small>
          {answer ?? '(not found)'}
        </div>
        {view.status === 'playing' ? (
          <>
            <p>
              {people.a.name}: {tries(view.wrong.a).toLowerCase()}
              <br />
              {people.b.name}: {tries(view.wrong.b).toLowerCase()}
            </p>
            <button className="btn" onClick={() => send({ action: 'skip' })}>
              Too hard? New word
            </button>
            <p className="muted">The game scores itself. Hints show at 20 s and 40 s.</p>
          </>
        ) : (
          <div className="phone-big">{resultLine(view, people)}</div>
        )}
      </div>
    );
  },
};
