import { useEffect, useRef, useState } from 'react';
import { Character } from '../../characters/Character';
import { play } from '../../sound';
import { Countdown } from '../../ui/common';
import type { DuelPeople, MinigameViews, PhoneViewProps } from '../types';
import {
  LETTERS,
  MAX_LETTERS,
  MAX_MISSES,
  MIN_LETTERS,
  WRITE_MS,
  cleanWord,
  otherSide,
  type Board,
  type HangmanView,
} from './logic';

type Side = 'a' | 'b';

/** The gallows, with one more body part for each miss: head, body, arms, legs. */
export function Gallows({ misses, solved, size = 160 }: { misses: number; solved?: boolean; size?: number }) {
  const hanged = misses >= MAX_MISSES;
  const parts = [
    <circle key="head" cx="86" cy="46" r="12" />,
    <line key="body" x1="86" y1="58" x2="86" y2="96" />,
    <line key="arm-l" x1="86" y1="68" x2="70" y2="84" />,
    <line key="arm-r" x1="86" y1="68" x2="102" y2="84" />,
    <line key="leg-l" x1="86" y1="96" x2="72" y2="118" />,
    <line key="leg-r" x1="86" y1="96" x2="100" y2="118" />,
  ];
  return (
    <svg className={`hm-gallows${hanged ? ' hanged' : ''}${solved ? ' solved' : ''}`} viewBox="0 0 130 150" width={size} height={size * (150 / 130)} aria-label={`${misses} of ${MAX_MISSES} misses`}>
      <g className="hm-frame">
        <line x1="12" y1="140" x2="70" y2="140" />
        <line x1="32" y1="140" x2="32" y2="12" />
        <line x1="32" y1="12" x2="86" y2="12" />
        <line x1="32" y1="34" x2="54" y2="12" />
        <line x1="86" y1="12" x2="86" y2="34" />
      </g>
      <g className="hm-man">
        {parts.slice(0, misses)}
        {hanged && (
          <g className="hm-eyes">
            <path d="M79 41 l5 5 M84 41 l-5 5 M88 41 l5 5 M93 41 l-5 5" />
          </g>
        )}
      </g>
    </svg>
  );
}

/** The word as blanks, filled in as letters are found (or all of it, at the end). */
function Word({ pattern, word, small }: { pattern: (string | null)[]; word?: string | null; small?: boolean }) {
  return (
    <div className={`hm-word${small ? ' small' : ''}${pattern.length > 12 ? ' long' : ''}`}>
      {pattern.map((l, i) => {
        const missed = !l && word;
        return (
          <span key={i} className={`hm-cell${l ? ' found' : ''}${missed ? ' missed' : ''}`}>
            {l ?? (word ? word[i] : '')}
          </span>
        );
      })}
    </div>
  );
}

function Misses({ board }: { board: Board }) {
  return (
    <div className="hm-misses">
      {board.misses.length === 0 ? <span className="muted">No misses yet</span> : board.misses.map((l) => <span key={l}>{l}</span>)}
      <small>{MAX_MISSES - board.misses.length} left</small>
    </div>
  );
}

/** What a duelist's word slot says while words are being written. */
function writingStatus(view: HangmanView, s: Side) {
  if (view.spare[s]) return 'Picked a word for them';
  if (view.approved[s]) return 'Word checked ✓';
  if (view.written[s]) return 'Host is checking…';
  return view.rejected[s] ? 'Typing a new word…' : 'Typing a word…';
}

function useHostSounds(view: HangmanView) {
  const last = useRef(view.status);
  const misses = (view.boards?.a.misses.length ?? 0) + (view.boards?.b.misses.length ?? 0);
  const lastMisses = useRef(misses);
  useEffect(() => {
    if (view.status === 'guessing' && last.current === 'writing') play('reveal');
    if (view.status === 'reveal' && last.current === 'guessing') play('fanfare');
    last.current = view.status;
  }, [view.status]);
  useEffect(() => {
    if (misses > lastMisses.current) play('lose');
    lastMisses.current = misses;
  }, [misses]);
}

/** One duelist's side of the big screen: them, their gallows and the word they're guessing. */
function HostSide({ view, people, side }: { view: HangmanView; people: DuelPeople; side: Side }) {
  const p = people[side];
  const b = view.boards?.[side];
  const ended = view.status === 'reveal' || view.status === 'done';
  const won = ended && view.winner === side;
  const lost = ended && view.winner !== side;
  return (
    <div className={`hm-side${won ? ' won' : ''}${b?.hanged ? ' out' : ''}`}>
      <div className="hm-who">
        <Character color={p.color} accessory={p.accessory} size={70} flip={side === 'b'} pose={won ? 'win' : lost ? 'lose' : 'idle'} />
        <div className="big-name">{p.name}</div>
      </div>
      <Gallows misses={b?.misses.length ?? 0} solved={b?.solved} size={165} />
      {b ? (
        <>
          <Word pattern={b.pattern} word={ended ? view.words[otherSide(side)] : null} />
          <Misses board={b} />
          {b.hanged && !ended && <div className="hm-tag">Hanged! 😵</div>}
        </>
      ) : (
        <div className={view.approved[side] ? 'locked' : 'thinking'}>{writingStatus(view, side)}</div>
      )}
    </div>
  );
}

/** Type a word for the other duelist to guess. */
function WordForm({ rejected, other, send }: { rejected: boolean; other: string; send: PhoneViewProps['send'] }) {
  const [text, setText] = useState('');
  const word = cleanWord(text);
  return (
    <form
      className="hl-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (word) send({ action: 'word', word });
      }}
    >
      <div className="phone-big">Pick a word for {other}</div>
      {rejected && <p className="hm-bad">The Host sent your word back. Try a real word!</p>}
      <input
        className="hl-input hm-input"
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        maxLength={MAX_LETTERS}
        placeholder="SECRET"
        value={text}
        // Letters only: spaces and symbols never make it into the box.
        onChange={(e) => setText(e.target.value.replace(/[^a-z]/gi, '').toUpperCase().slice(0, MAX_LETTERS))}
        aria-label="Your secret word"
      />
      <p className="muted">
        One word, letters only, {MIN_LETTERS}–{MAX_LETTERS} long ({text.length}/{MAX_LETTERS})
      </p>
      <button className="btn btn-primary btn-huge" disabled={!word}>
        Lock in
      </button>
    </form>
  );
}

function resultLine(view: HangmanView, people: DuelPeople, side?: Side) {
  if (view.winner === 'draw') return 'Both hanged: it’s a draw!';
  const w = view.winner as Side;
  if (side) return w === side ? 'You solved it first! 🎉' : `${people[w].name} solved it first 😵`;
  return `${people[w].name} solved it first!`;
}

export const hangmanViews: MinigameViews<HangmanView> = {
  HostView({ view, people, now }) {
    useHostSounds(view);
    const ended = view.status === 'reveal' || view.status === 'done';
    return (
      <div className="hm-host">
        <div className="hm-center">
          {view.status === 'writing' && <Countdown endsAt={view.writeEndsAt} now={now} total={WRITE_MS} size={90} />}
          <h2 className="trivia-call">
            {view.status === 'writing' && 'Type a secret word for your opponent on your phone!'}
            {view.status === 'guessing' && `Race! Guess the word letter by letter. ${MAX_MISSES} misses and you’re hanged.`}
            {ended && resultLine(view, people)}
          </h2>
        </div>
        <div className="hm-arena">
          <HostSide view={view} people={people} side="a" />
          <div className="vs">VS</div>
          <HostSide view={view} people={people} side="b" />
        </div>
      </div>
    );
  },

  DuelistView({ view, side, people, send, now }) {
    const other = otherSide(side);
    // What this phone typed, to show while it waits (the word isn't sent back during the race).
    const [mine, setMine] = useState<string | null>(null);
    const sendWord: PhoneViewProps['send'] = (payload) => {
      setMine(payload.word);
      send(payload);
    };

    if (view.status === 'writing') {
      if (!view.written[side] && !view.spare[side]) {
        return (
          <div className="phone-center">
            <div className="phone-row">
              <span>Secret word</span>
              <Countdown endsAt={view.writeEndsAt} now={now} total={WRITE_MS} size={56} />
            </div>
            <WordForm rejected={view.rejected[side]} other={people[other].name} send={sendWord} />
          </div>
        );
      }
      return (
        <div className="phone-center">
          <div className="phone-big">{view.approved[side] ? 'Word checked ✓' : 'Locked in'}</div>
          {mine && view.written[side] && <p className="hm-secret">{mine}</p>}
          <p className="muted">
            {view.approved[side] ? 'Waiting for' : 'The Host is checking it. Waiting for'}{' '}
            {view.approved[other] ? 'the race to start…' : `${people[other].name}…`}
          </p>
        </div>
      );
    }

    const b = view.boards![side];
    const them = view.boards![other];
    const ended = view.status === 'reveal' || view.status === 'done';
    if (ended) {
      return (
        <div className="phone-center">
          <div className="phone-big">{resultLine(view, people, side)}</div>
          <Gallows misses={b.misses.length} solved={b.solved} size={110} />
          <p>The word was</p>
          <Word pattern={b.pattern} word={view.words[other]} small />
          <p className="muted">
            {people[other].name} had to guess <b>{view.words[side]}</b>
          </p>
        </div>
      );
    }
    return (
      <div className="phone-center hm-phone">
        <div className="hm-phone-top">
          <Gallows misses={b.misses.length} size={90} />
          <div>
            <Misses board={b} />
            <p className="muted hm-them">
              {people[other].name}: {them.pattern.filter(Boolean).length}/{them.pattern.length} letters,{' '}
              {them.hanged ? 'hanged!' : `${them.misses.length} ${them.misses.length === 1 ? 'miss' : 'misses'}`}
            </p>
          </div>
        </div>
        <Word pattern={b.pattern} small />
        {b.hanged ? (
          <div className="phone-big">Hanged! 😵</div>
        ) : (
          <div className="fl-grid hm-keys">
            {LETTERS.map((l) => {
              const used = b.hits.includes(l) ? ' hit' : b.misses.includes(l) ? ' miss' : '';
              return (
                <button key={l} className={`btn fl-key${used}`} disabled={!!used} onClick={() => send({ action: 'guess', letter: l })}>
                  {l}
                </button>
              );
            })}
          </div>
        )}
        {b.hanged && <p className="muted">You’re out. {people[other].name} still has to solve theirs to win!</p>}
      </div>
    );
  },

  RefereeView({ view, people, send }) {
    if (view.status === 'writing') {
      return (
        <div className="phone-center">
          <div className="phone-big">Check the words</div>
          <p className="muted">Real words only. Keep them secret!</p>
          {(['a', 'b'] as Side[]).map((s) => (
            <div key={s} className="hm-check">
              <small>
                {people[s].name}’s word for {people[otherSide(s)].name}
              </small>
              {view.spare[s] ? (
                <p>Ran out of time: picked one for them ✓</p>
              ) : !view.written[s] ? (
                <p className="muted">{view.rejected[s] ? 'Typing a new word…' : 'Typing…'}</p>
              ) : (
                <>
                  <p className="hm-secret">{view.words[s]}</p>
                  {view.approved[s] ? (
                    <p>Checked ✓</p>
                  ) : (
                    <div className="judge-buttons">
                      <button className="btn btn-good judge" onClick={() => send({ action: 'check', side: s, ok: true })}>
                        Real word ✓
                      </button>
                      <button className="btn btn-danger judge" onClick={() => send({ action: 'check', side: s, ok: false })}>
                        Send back ✗
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      );
    }
    const ended = view.status === 'reveal' || view.status === 'done';
    return (
      <div className="phone-center">
        <div className="phone-big">{ended ? resultLine(view, people) : 'The race is on!'}</div>
        {(['a', 'b'] as Side[]).map((s) => {
          const b = view.boards![s];
          return (
            <div key={s} className="hm-check">
              <small>{people[s].name} is guessing</small>
              <Word pattern={b.pattern} word={ended ? view.words[otherSide(s)] : null} small />
              <Misses board={b} />
            </div>
          );
        })}
        {!ended && <p className="muted">The game scores itself. Just watch!</p>}
      </div>
    );
  },
};
