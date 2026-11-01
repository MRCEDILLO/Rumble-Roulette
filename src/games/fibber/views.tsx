import { useEffect, useRef, useState } from 'react';
import { play } from '../../sound';
import { Countdown } from '../../ui/common';
import { useTicker } from '../../ui/hooks';
import { Contestant } from '../trivia/Podium';
import type { DuelPeople, MinigameViews, PhoneViewProps } from '../types';
import { BLANK, MAX_LIE, VOTE_MS, WRITE_MS, cleanLie, revealStep, unmaskOrder, type FibberView, type Side, type Voter } from './logic';

const label = (p: Voter) => (p.host ? `${p.name} (Host)` : p.name);
const other = (s: Side): Side => (s === 'a' ? 'b' : 'a');

/** Which reveal step is showing (ticks along on its own). */
function useStep(view: FibberView, now: () => number) {
  useTicker(200, view.status === 'reveal');
  if (view.status === 'reveal') return revealStep(view.revealAt, now());
  return view.status === 'writing' || view.status === 'voting' ? -1 : 3;
}

/** How many options have been unmasked so far (0 to 3). */
const unmasked = (step: number) => Math.max(0, step);

/** The fact, with the blank as a gap (or filled in with the truth once it's out). */
function FactCard({ view, fill, small, compact }: { view: FibberView; fill?: string | null; small?: boolean; compact?: boolean }) {
  const [before, after] = view.fact.split(BLANK);
  return (
    <div className={`fb-fact${small ? ' small' : ''}${compact ? ' compact' : ''}`}>
      {before}
      {fill ? <span className="fb-blank filled">{fill}</span> : <span className="fb-blank" aria-label="blank" />}
      {after}
    </div>
  );
}

/** Ticks for who has voted. */
function Progress({ view }: { view: FibberView }) {
  return (
    <div className="jx-progress">
      {view.voters.map((p) => (
        <span key={p.id} className={`chip${view.voted.includes(p.id) ? ' jx-in' : ''}`}>
          {view.voted.includes(p.id) ? '✓ ' : '… '}
          {label(p)}
        </span>
      ))}
    </div>
  );
}

/** The three answers on the big screen, unmasked one by one during the reveal. */
function Options({ view, people, step, small }: { view: FibberView; people: DuelPeople; step: number; small?: boolean }) {
  const order = unmaskOrder(view.options);
  const open = order.slice(0, unmasked(step));
  return (
    <div className={`fb-options${small ? ' small' : ''}`}>
      {view.options.map((o, i) => {
        const shown = open.includes(i);
        const pickers = view.votes ? view.voters.filter((p) => view.votes![p.id] === i) : [];
        const tag = !shown ? null : o.owner === 'truth' ? 'fb-truth' : 'fb-lie';
        return (
          <div key={i} className={`fb-option${tag ? ` ${tag}` : ''}`}>
            <div className="fb-option-main">
              <span className="fb-num">{i + 1}</span>
              <span className="fb-text">{o.text}</span>
            </div>
            {view.votes && (
              <div className="fb-pickers">
                {pickers.length ? pickers.map((p) => <span key={p.id} className="chip">{p.name}</span>) : <span className="muted">No votes</span>}
              </div>
            )}
            {shown && (
              <div className="fb-owner">
                {o.owner === 'truth' ? '✅ The truth!' : `🤥 ${people[o.owner as Side].name}’s lie${pickers.length ? ` fooled ${pickers.length}` : ''}`}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function resultLine(view: FibberView, people: DuelPeople) {
  const f = view.fooled;
  if (view.status === 'replay') {
    if (view.noLie.length === 2) return 'Nobody wrote a lie in time! New fact…';
    if (f && f.a === 0) return 'Nobody was fooled! New fact…';
    return `Both fooled ${f?.a}! New fact…`;
  }
  const w = view.winner as Side;
  if (view.noLie.length) return `${people[other(w)].name} didn’t write a lie in time. ${people[w].name} wins!`;
  return `${people[w].name} fooled ${f![w]}, ${people[other(w)].name} fooled ${f![other(w)]}. ${people[w].name} wins!`;
}

/** Where a duelist writes their lie. */
function LieForm({ view, side, send }: { view: FibberView; side: Side; send: PhoneViewProps['send'] }) {
  const [text, setText] = useState('');
  const clean = cleanLie(text);
  const why = view.rejected[side];
  return (
    <form
      className="hl-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (clean) send({ action: 'lie', text: clean });
      }}
    >
      <input
        className="hl-input jx-input"
        autoComplete="off"
        maxLength={MAX_LIE}
        placeholder="Your lie"
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Your lie"
      />
      {why === 'truth' && <p className="hm-bad">Whoa, that’s actually the real answer! Write a lie instead.</p>}
      {why === 'taken' && <p className="hm-bad">The other player already wrote that. Try a different lie.</p>}
      <button className="btn btn-primary btn-huge" disabled={!clean}>
        Lock in my lie
      </button>
      <p className="muted">Make it sound true. Keep your screen hidden!</p>
    </form>
  );
}

/** What the Host and audience see (they vote). */
function VoterScreen({ view, people, now, send, me, isHost }: PhoneViewProps<FibberView> & { me: Voter | undefined; isHost: boolean }) {
  const step = useStep(view, now);
  if (view.status === 'writing') {
    return (
      <div className="phone-center">
        <FactCard view={view} small />
        <p>
          {people.a.name} and {people.b.name} are writing lies to fill the blank…
        </p>
        <p className="muted">Soon you’ll pick which answer is the truth.</p>
        {isHost && view.written.length === 0 && (
          <button className="btn" onClick={() => send({ action: 'newFact' })}>
            Someone knows this one: new fact
          </button>
        )}
      </div>
    );
  }
  if (view.status === 'voting') {
    const voted = me && view.voted.includes(me.id);
    const waiting = view.voters.filter((p) => !view.voted.includes(p.id));
    return (
      <div className="phone-center">
        <FactCard view={view} small />
        {me && !voted ? (
          <>
            <p>Which one is the truth?</p>
            <div className="fb-vote">
              {view.options.map((o, i) => (
                <button key={i} className="btn btn-huge fb-pick" onClick={() => send({ action: 'vote', pick: i })}>
                  <span className="fb-num">{i + 1}</span>
                  <span className="fb-text">{o.text}</span>
                </button>
              ))}
            </div>
            <Countdown endsAt={view.voteUntil!} now={now} total={VOTE_MS} size={56} />
          </>
        ) : (
          <>
            <div className="phone-big">{me ? 'Vote locked in ✓' : 'Watch the big screen!'}</div>
            {waiting.length > 0 && <p className="muted">Waiting for {waiting.map(label).join(', ')}.</p>}
            {isHost && waiting.length > 0 && (
              <button className="btn" onClick={() => send({ action: 'skip' })}>
                Go on without {waiting.length === 1 ? waiting[0].name : 'them'}
              </button>
            )}
          </>
        )}
      </div>
    );
  }
  const pick = me && view.votes ? view.votes[me.id] : undefined;
  const truthOut = step >= 3;
  const picked = pick === undefined ? null : view.options[pick];
  return (
    <div className="phone-center">
      <FactCard view={view} fill={truthOut ? view.answer : null} small />
      {picked && truthOut ? (
        <div className="phone-big">
          {picked.owner === 'truth' ? 'You spotted the truth! 🕵️' : `Fooled by ${people[picked.owner as Side].name}! 🤥`}
        </div>
      ) : (
        <div className="phone-big">Watch the big screen!</div>
      )}
      {picked && (
        <p className="muted">
          You picked: <b className="fb-mine">{picked.text}</b>
        </p>
      )}
      {(view.status === 'replay' || view.status === 'result' || view.status === 'done') && <p>{resultLine(view, people)}</p>}
    </div>
  );
}

export const fibberViews: MinigameViews<FibberView> = {
  HostView({ view, people, now }) {
    const step = useStep(view, now);
    const last = useRef(view.status);
    const lastStep = useRef(step);
    useEffect(() => {
      if (view.status === 'voting' && last.current === 'writing') play('whoosh');
      if (view.status === 'replay' && last.current !== 'replay') play('lose');
      if (view.status === 'result' && last.current !== 'result') play('fanfare');
      last.current = view.status;
    }, [view.status]);
    useEffect(() => {
      if (view.status === 'reveal' && step !== lastStep.current) play(step === 3 ? 'reveal' : 'tick');
      lastStep.current = step;
    }, [step, view.status]);

    const done = view.status === 'result' || view.status === 'done';
    const contestant = (s: Side) => (
      <Contestant
        people={people}
        side={s}
        lit={view.status === 'writing' && view.written.includes(s)}
        won={done && view.winner === s}
        done={done}
      />
    );
    return (
      <div className="trivia-host">
        {contestant('a')}
        <div className="trivia-middle">
          {view.number > 1 && <div className="trivia-number">Fact {view.number}</div>}
          <FactCard view={view} fill={step >= 3 ? view.answer : null} compact={view.options.length > 0} />
          {view.status === 'writing' && (
            <>
              <h2 className="trivia-call">
                {people.a.name} and {people.b.name}: write a lie to fill the blank!
              </h2>
              <Countdown endsAt={view.writeUntil} now={now} total={WRITE_MS} size={100} />
              <div className="jx-progress">
                {(['a', 'b'] as Side[]).map((s) => (
                  <span key={s} className={`chip${view.written.includes(s) ? ' jx-in' : ''}`}>
                    {view.written.includes(s) ? '✓ ' : '✍️ '}
                    {people[s].name}
                  </span>
                ))}
              </div>
              <p className="fl-redraw">Audience: no peeking at their phones!</p>
            </>
          )}
          {view.status === 'voting' && (
            <>
              <Options view={view} people={people} step={-1} />
              <div className="fb-vote-row">
                <Countdown endsAt={view.voteUntil!} now={now} total={VOTE_MS} size={64} />
                <div>
                  <p className="fb-call">Which one is the truth? Vote on your phone!</p>
                  <Progress view={view} />
                </div>
              </div>
            </>
          )}
          {view.options.length > 0 && view.status !== 'voting' && view.status !== 'writing' && <Options view={view} people={people} step={step} />}
          {(view.status === 'replay' || done) && <h2 className="trivia-call fb-call">{resultLine(view, people)}</h2>}
        </div>
        {contestant('b')}
      </div>
    );
  },

  DuelistView({ view, side, people, now, send }) {
    const step = useStep(view, now);
    const mine = view.lies[side];
    if (view.status === 'writing') {
      const wrote = view.written.includes(side);
      return (
        <div className="phone-center">
          <FactCard view={view} small />
          {wrote ? (
            <>
              <div className="phone-big">Lie locked in ✓</div>
              <p className="muted">{view.written.length === 2 ? 'Here comes the vote…' : `Waiting for ${people[other(side)].name}…`}</p>
            </>
          ) : (
            <>
              <p>Write a lie to fill the blank. Fool the audience into thinking it’s true!</p>
              <LieForm view={view} side={side} send={send} />
            </>
          )}
          <Countdown endsAt={view.writeUntil} now={now} total={WRITE_MS} size={56} />
        </div>
      );
    }
    if (view.status === 'voting' || (view.status === 'reveal' && step < 3)) {
      return (
        <div className="phone-center">
          <FactCard view={view} small />
          <div className="phone-big">{view.status === 'voting' ? 'The audience is voting…' : 'Watch the big screen!'}</div>
          {mine && <p>Your lie: <b className="fb-mine">{mine}</b></p>}
          <p className="muted">Fingers crossed they believe you…</p>
        </div>
      );
    }
    const fooled = view.fooled?.[side] ?? 0;
    const end = view.status === 'result' || view.status === 'done';
    return (
      <div className="phone-center">
        <FactCard view={view} fill={view.answer} small />
        {end ? (
          <div className="phone-big">{view.winner === side ? 'You win! 🎉' : 'You lose 😵'}</div>
        ) : (
          <div className="phone-big">{view.status === 'replay' ? 'Draw!' : 'The truth is out!'}</div>
        )}
        {view.options.length > 0 && <p>You fooled {fooled === 1 ? '1 person' : `${fooled} people`}.</p>}
        {(view.status === 'replay' || end) && <p className="muted">{resultLine(view, people)}</p>}
      </div>
    );
  },

  RefereeView(props) {
    const me = props.view.voters.find((p) => p.host);
    return <VoterScreen {...props} me={me} isHost />;
  },

  AudienceView({ seat, ...props }) {
    const me = props.view.voters.find((p) => p.id === seat && !p.host);
    return <VoterScreen {...props} me={me} isHost={false} />;
  },
};
