import { useEffect, useRef, useState } from 'react';
import { play } from '../../sound';
import { useTicker } from '../../ui/hooks';
import { Contestant } from '../trivia/Podium';
import type { DuelPeople, MinigameViews, PhoneViewProps } from '../types';
import { MAX_ANSWER, SIDES, cleanAnswer, type Answerer, type JinxView, type Side } from './logic';

const label = (p: Answerer) => (p.host ? `${p.name} (Host)` : p.name);

/** Seconds until the duelists say their answers (0 once it's time). */
function useThinkLeft(view: JinxView, now: () => number) {
  const counting = view.status === 'saying' && view.sayAt !== null;
  useTicker(200, counting);
  if (!counting) return 0;
  return Math.max(0, Math.ceil((view.sayAt! - now()) / 1000));
}

/** Who still has to send their answers. */
function waitingOn(view: JinxView) {
  return view.answerers.filter((p) => !view.done.includes(p.id));
}

function PromptCard({ text, small }: { text: string; small?: boolean }) {
  return <div className={`jx-prompt${small ? ' small' : ''}`}>{text}</div>;
}

/** Everyone's answers, grouped by who wrote them. */
function AnswerBoard({ view, small }: { view: JinxView; small?: boolean }) {
  return (
    <div className={`jx-board${small ? ' small' : ''}`}>
      {view.answerers
        .filter((p) => view.answers?.[p.id])
        .map((p) => (
          <div key={p.id} className="jx-group">
            <small>{label(p)}</small>
            {view.answers![p.id].map((a, i) => (
              <div key={i} className="jx-answer" style={{ animationDelay: `${i * 0.15}s` }}>
                {a}
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}

/** Ticks for who has sent their answers. */
function Progress({ view }: { view: JinxView }) {
  return (
    <div className="jx-progress">
      {view.answerers.map((p) => (
        <span key={p.id} className={`chip${view.done.includes(p.id) ? ' jx-in' : ''}`}>
          {view.done.includes(p.id) ? '✓ ' : '… '}
          {label(p)}
        </span>
      ))}
    </div>
  );
}

/** Where the Host and audience type their answers. */
function AnswerForm({ view, people, send }: { view: JinxView; people: DuelPeople; send: PhoneViewProps['send'] }) {
  const [texts, setTexts] = useState<string[]>(() => Array(view.each).fill(''));
  const clean = texts.map(cleanAnswer);
  const lower = clean.map((a) => a?.toLowerCase());
  const repeats = lower.some((a, i) => a && lower.indexOf(a) !== i);
  const ready = clean.every(Boolean) && !repeats;
  return (
    <form
      className="hl-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) send({ action: 'answers', answers: clean });
      }}
    >
      <PromptCard text={view.prompt} small />
      <p>
        {view.each > 1 ? `Write ${view.each} different answers.` : 'Write one answer.'} If {people.a.name} or {people.b.name} says the same thing, they’re jinxed!
      </p>
      {texts.map((t, i) => (
        <input
          key={i}
          className="hl-input jx-input"
          autoComplete="off"
          maxLength={MAX_ANSWER}
          placeholder={view.each > 1 ? `Answer ${i + 1}` : 'Your answer'}
          value={t}
          onChange={(e) => setTexts(texts.map((x, j) => (j === i ? e.target.value : x)))}
          aria-label={`Answer ${i + 1}`}
        />
      ))}
      {repeats && <p className="hm-bad">Make each answer different.</p>}
      <button className="btn btn-primary btn-huge" disabled={!ready}>
        Lock in
      </button>
      <p className="muted">Keep your screen hidden from the players!</p>
    </form>
  );
}

function resultLine(view: JinxView, people: DuelPeople) {
  if (view.status === 'replay') {
    return view.matched?.a ? 'Both got jinxed! New question…' : 'Nobody got jinxed! New question…';
  }
  const loser = people[view.winner === 'a' ? 'b' : 'a'];
  return `Jinx! ${loser.name} said the same. ${people[view.winner as Side].name} wins!`;
}

const revealed = (view: JinxView) => view.status === 'reveal' || view.status === 'replay' || view.status === 'result' || view.status === 'done';

export const jinxViews: MinigameViews<JinxView> = {
  HostView({ view, people, now }) {
    const last = useRef(view.status);
    const left = useThinkLeft(view, now);
    const said = useRef(false);
    useEffect(() => {
      if (view.status === 'saying' && last.current === 'writing') play('whoosh');
      if (view.status === 'reveal' && last.current !== 'reveal') play('reveal');
      if (view.status === 'replay' && last.current !== 'replay') play('lose');
      if (view.status === 'result' && last.current !== 'result') play('buzz');
      last.current = view.status;
    }, [view.status]);
    useEffect(() => {
      if (view.status !== 'saying') said.current = false;
      else if (left > 0) play('tick');
      else if (!said.current) {
        said.current = true;
        play('drum');
      }
    }, [left, view.status]);

    const done = view.status === 'result' || view.status === 'done';
    const contestant = (s: Side) => (
      <Contestant
        people={people}
        side={s}
        lit={view.status === 'saying' && left === 0}
        won={done && view.winner === s}
        done={done}
      />
    );
    return (
      <div className="trivia-host">
        {contestant('a')}
        <div className="trivia-middle">
          {view.number > 1 && <div className="trivia-number">Question {view.number}</div>}
          {view.status === 'writing' ? (
            <>
              {/* The players can see this screen, so the prompt stays hidden until the answers are in. */}
              <div className="jx-prompt hidden">🤐 Top secret question</div>
              <h2 className="trivia-call">Audience: write your answers on your phone!</h2>
              <Progress view={view} />
              <p className="fl-redraw">
                {people.a.name} and {people.b.name}: no peeking!
              </p>
            </>
          ) : (
            <PromptCard text={view.prompt} />
          )}
          {view.status === 'saying' && (
            <>
              {left > 0 ? (
                <div className="jx-count">{left}</div>
              ) : (
                <h2 className="trivia-call jx-say">Say your answers out loud, together!</h2>
              )}
              <p className="fl-redraw">Don’t say the same as the audience…</p>
            </>
          )}
          {revealed(view) && <AnswerBoard view={view} />}
          {view.status === 'reveal' && <p className="fl-redraw">Did anyone say the same? The Host decides…</p>}
          {(view.status === 'replay' || done) && <h2 className="trivia-call">{resultLine(view, people)}</h2>}
        </div>
        {contestant('b')}
      </div>
    );
  },

  DuelistView({ view, side, people, now }) {
    const left = useThinkLeft(view, now);
    if (view.status === 'writing') {
      return (
        <div className="phone-center">
          <div className="jx-mystery">🤐</div>
          <div className="phone-big">The audience is writing answers…</div>
          <p>
            Soon you’ll both get the same “Name a…” question. Say an answer out loud, but <b>don’t say the same as anyone in the audience</b>!
          </p>
          <p className="muted">Waiting for {waitingOn(view).map(label).join(', ')}.</p>
        </div>
      );
    }
    if (view.status === 'saying') {
      return (
        <div className="phone-center">
          <PromptCard text={view.prompt} small />
          {left > 0 ? (
            <>
              <div className="jx-count small">{left}</div>
              <p>Think of something the audience won’t say…</p>
            </>
          ) : (
            <div className="phone-big">Say it out loud now! 📣</div>
          )}
        </div>
      );
    }
    if (view.status === 'reveal') {
      return (
        <div className="phone-center">
          <PromptCard text={view.prompt} small />
          <div className="phone-big">Answers on the big screen!</div>
          <p className="muted">Fingers crossed nobody said yours…</p>
        </div>
      );
    }
    if (view.status === 'replay') {
      return (
        <div className="phone-center">
          <div className="phone-big">{view.matched?.a ? 'You both got jinxed!' : 'Nobody got jinxed!'}</div>
          <p className="muted">Get ready for a new question…</p>
        </div>
      );
    }
    return (
      <div className="phone-center">
        <div className="phone-big">{view.winner === side ? 'You win! 🎉' : 'Jinxed! 😵'}</div>
        <p>{view.winner === side ? `${people[side === 'a' ? 'b' : 'a'].name} said the same as the audience.` : 'You said the same as the audience.'}</p>
      </div>
    );
  },

  RefereeView({ view, people, now, send }) {
    const left = useThinkLeft(view, now);
    const [marks, setMarks] = useState<Record<Side, boolean | null>>({ a: null, b: null });
    // Fresh marks for each new question.
    useEffect(() => setMarks({ a: null, b: null }), [view.number]);
    const host = view.answerers.find((p) => p.host);

    if (view.status === 'writing') {
      const waiting = waitingOn(view);
      if (host && waiting.includes(host)) {
        return (
          <div className="phone-center">
            <AnswerForm key={view.number} view={view} people={people} send={send} />
          </div>
        );
      }
      return (
        <div className="phone-center">
          <PromptCard text={view.prompt} small />
          <p>Waiting for {waiting.map(label).join(', ')}…</p>
          <Progress view={view} />
          <button className="btn" onClick={() => send({ action: 'skip' })}>
            Go on without {waiting.length === 1 ? waiting[0].name : 'them'}
          </button>
        </div>
      );
    }
    if (view.status === 'saying') {
      return (
        <div className="phone-center">
          <PromptCard text={view.prompt} small />
          <p>
            {left > 0
              ? `${people.a.name} and ${people.b.name} say their answers in ${left}…`
              : `Listen to ${people.a.name} and ${people.b.name} say their answers, then show everyone’s.`}
          </p>
          <button className="btn btn-primary btn-huge" disabled={left > 0} onClick={() => send({ action: 'reveal' })}>
            Reveal the answers
          </button>
        </div>
      );
    }
    if (view.status === 'reveal') {
      return (
        <div className="phone-center">
          <PromptCard text={view.prompt} small />
          <AnswerBoard view={view} small />
          <p>Did they say the same as anyone? Close enough counts: your call.</p>
          {SIDES.map((s) => (
            <div key={s} className="jx-mark">
              <b>{people[s].name}</b>
              <button className={`btn${marks[s] === true ? ' btn-danger' : ''}`} onClick={() => setMarks({ ...marks, [s]: true })}>
                Same 😵
              </button>
              <button className={`btn${marks[s] === false ? ' btn-good' : ''}`} onClick={() => setMarks({ ...marks, [s]: false })}>
                Safe ✓
              </button>
            </div>
          ))}
          <button
            className="btn btn-primary btn-huge"
            disabled={marks.a === null || marks.b === null}
            onClick={() => send({ action: 'judge', a: marks.a, b: marks.b })}
          >
            Lock it in
          </button>
          <p className="muted">Both the same or both safe: you play a new question.</p>
        </div>
      );
    }
    if (view.status === 'replay') {
      return (
        <div className="phone-center">
          <p>{resultLine(view, people)}</p>
          <button className="btn btn-primary btn-huge" onClick={() => send({ action: 'next' })}>
            New question
          </button>
        </div>
      );
    }
    return (
      <div className="phone-center">
        <p>{resultLine(view, people)}</p>
      </div>
    );
  },

  AudienceView({ view, people, seat, send }) {
    const me = view.answerers.find((p) => p.id === seat && !p.host);
    if (view.status === 'writing' && me && !view.done.includes(me.id)) {
      return (
        <div className="phone-center">
          <AnswerForm key={view.number} view={view} people={people} send={send} />
        </div>
      );
    }
    if (view.status === 'writing') {
      return (
        <div className="phone-center">
          <PromptCard text={view.prompt} small />
          <div className="phone-big">{me ? 'Answers locked in ✓' : 'Watch the big screen!'}</div>
          <p className="muted">Waiting for {waitingOn(view).map(label).join(', ')}.</p>
        </div>
      );
    }
    return (
      <div className="phone-center">
        <PromptCard text={view.prompt} small />
        <p>Watch the big screen!</p>
        {revealed(view) && view.answers?.[seat] && <p className="muted">You wrote: {view.answers[seat].join(', ')}</p>}
      </div>
    );
  },
};
