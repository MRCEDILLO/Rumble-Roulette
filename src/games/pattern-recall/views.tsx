import { useEffect, useRef, useState } from 'react';
import { Character } from '../../characters/Character';
import { play, playNote } from '../../sound';
import { Countdown } from '../../ui/common';
import { useTicker } from '../../ui/hooks';
import type { DuelPeople, MinigameViews } from '../types';
import { FLASH_SHARE, PADS, inputMs, otherSide, stepMs, type PatternView } from './logic';

type Side = 'a' | 'b';
const SIDES: Side[] = ['a', 'b'];

/** Which flash of the pattern is on screen right now: the step number and whether its pad is lit. */
function flashAt(view: PatternView, t: number) {
  if (view.status !== 'showing' || !view.pattern || t < view.showAt) return null;
  const step = stepMs(view.length);
  const i = Math.floor((t - view.showAt) / step);
  if (i >= view.pattern.length) return null;
  return { i, lit: t - view.showAt - i * step < step * FLASH_SHARE ? view.pattern[i] : null };
}

/** Re-renders smoothly while the pattern is flashing, and says what is lit. */
function useFlash(view: PatternView, now: () => number) {
  useTicker(40, view.status === 'showing');
  return flashAt(view, now());
}

function PadShape({ shape }: { shape: (typeof PADS)[number]['shape'] }) {
  const props = { fill: 'rgba(255,255,255,0.9)', stroke: '#1b1035', strokeWidth: 3, strokeLinejoin: 'round' as const };
  return (
    <svg className="pr-shape" viewBox="0 0 40 40" aria-hidden="true">
      {shape === 'circle' && <circle cx="20" cy="20" r="12" {...props} />}
      {shape === 'square' && <rect x="8" y="8" width="24" height="24" rx="3" {...props} />}
      {shape === 'triangle' && <path d="M20 6 L34 32 H6 Z" {...props} />}
      {shape === 'star' && (
        <polygon
          points={Array.from({ length: 10 }, (_, i) => {
            const r = i % 2 ? 6 : 14;
            const a = (Math.PI / 5) * i - Math.PI / 2;
            return `${(20 + r * Math.cos(a)).toFixed(1)},${(21 + r * Math.sin(a)).toFixed(1)}`;
          }).join(' ')}
          {...props}
        />
      )}
    </svg>
  );
}

/** The four pads. `lit` lights one up; `onPress` makes them buttons. */
function Board({ lit, onPress, dim, big }: { lit: number | null; onPress?: (pad: number) => void; dim?: boolean; big?: boolean }) {
  return (
    <div className={`pr-board${big ? ' big' : ''}${dim ? ' dim' : ''}${onPress ? ' live' : ''}`}>
      {PADS.map((p) => {
        const cls = `pr-pad${lit === p.id ? ' lit' : ''}`;
        const style = { '--pad': p.color } as React.CSSProperties;
        const body = <PadShape shape={p.shape} />;
        return onPress ? (
          <button key={p.id} className={cls} style={style} aria-label={p.name} onPointerDown={() => onPress(p.id)}>
            {body}
          </button>
        ) : (
          <div key={p.id} className={cls} style={style} aria-label={p.name}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

/** One dot per colour in the pattern, filled for each one got right, with a cross where they slipped. */
function Dots({ view, side }: { view: PatternView; side: Side }) {
  const right = view.correct[side];
  const out = view.progress[side] === 'out';
  return (
    <div className="pr-dots" aria-label={`${right} of ${view.length}`}>
      {Array.from({ length: view.length }, (_, i) => {
        const pad = view.pattern?.[i];
        const shown = i < right && pad !== undefined;
        const cls = i < right ? 'on' : out && i === right ? 'slip' : '';
        return (
          <span key={i} className={cls} style={shown ? ({ '--pad': PADS[pad].color } as React.CSSProperties) : undefined}>
            {cls === 'slip' ? '✕' : ''}
          </span>
        );
      })}
    </div>
  );
}

/** The whole pattern as a row of chips, shown after each round. */
function PatternRow({ pattern }: { pattern: number[] }) {
  return (
    <div className="pr-row">
      {pattern.map((pad, i) => (
        <span key={i} className="pr-chip" style={{ '--pad': PADS[pad].color } as React.CSSProperties} title={PADS[pad].name}>
          <PadShape shape={PADS[pad].shape} />
        </span>
      ))}
    </div>
  );
}

const secs = (ms: number | null) => `${((ms ?? 0) / 1000).toFixed(1)} s`;

function sideLine(view: PatternView, side: Side) {
  const p = view.progress[side];
  if (p === 'done') return view.status === 'input' ? 'Got it! ✓' : `Got it in ${secs(view.took[side])} ✓`;
  if (p === 'out') {
    if (view.timedOut[side]) return `Out of time at ${view.correct[side]}/${view.length}`;
    return `Slipped at colour ${view.correct[side] + 1}`;
  }
  return view.status === 'input' ? `${view.correct[side]}/${view.length}…` : 'Watching…';
}

function resultLine(view: PatternView, people: DuelPeople, side?: Side) {
  const end = view.roundEnd;
  if (!end) return '';
  if (end.kind === 'both') return `${side ? 'You both' : 'Both'} got it! Next one is ${view.length + 1} long.`;
  if (end.kind === 'replay') {
    if (view.progress.a === 'done') return 'Dead heat! Same length again.';
    return `${side ? 'You both' : 'Both'} slipped at the same spot. Same length again!`;
  }
  const w = end.side;
  const l = otherSide(w);
  const wName = side === w ? 'You' : people[w].name;
  const lName = side === l ? 'you' : people[l].name;
  const tail = side ? (side === w ? ' 🎉' : ' 😵') : '!';
  if (end.why === 'quicker') return `${wName} ${side === w ? 'were' : 'was'} quicker: ${secs(view.took[w])} to ${secs(view.took[l])}${tail}`;
  if (end.why === 'further') return `${side === w ? 'You' : people[w].name} got further: ${view.correct[w]} to ${view.correct[l]}${tail}`;
  return `${wName} got it and ${lName} didn’t${tail}`;
}

/** "Watch…" / "Your turn!" / the result, for the top of each screen. */
function phaseLine(view: PatternView, t: number) {
  if (view.status === 'showing') return t < view.showAt ? 'Get ready… watch!' : 'Watch the pattern…';
  if (view.status === 'input') return 'Repeat it!';
  return '';
}

function RoundLine({ view }: { view: PatternView }) {
  return (
    <div className="pr-round">
      <b>Round {view.round}</b>
      <span className="muted">{view.length} colours</span>
    </div>
  );
}

function HostSide({ view, people, side }: { view: PatternView; people: DuelPeople; side: Side }) {
  const p = people[side];
  const won = view.winner === side;
  const lost = view.winner === otherSide(side);
  const prog = view.progress[side];
  return (
    <div className={`pr-player${prog === 'done' ? ' done' : ''}${prog === 'out' ? ' out' : ''}${won ? ' won' : ''}`}>
      <Character color={p.color} accessory={p.accessory} size={60} pose={won ? 'win' : lost ? 'lose' : 'idle'} />
      <div className="pr-player-info">
        <div className="pr-player-name">{p.name}</div>
        <Dots view={view} side={side} />
        <div className="muted">{sideLine(view, side)}</div>
      </div>
    </div>
  );
}

function useHostSounds(view: PatternView, flash: ReturnType<typeof flashAt>) {
  const lastFlash = useRef<string | null>(null);
  const key = flash && flash.lit !== null ? `${view.round}:${flash.i}` : null;
  useEffect(() => {
    if (key && key !== lastFlash.current && flash?.lit != null) playNote(flash.lit, (stepMs(view.length) * FLASH_SHARE) / 1000);
    lastFlash.current = key;
  });
  const outs = SIDES.filter((s) => view.progress[s] === 'out').length;
  const dones = SIDES.filter((s) => view.progress[s] === 'done').length;
  const last = useRef({ outs, dones, round: view.round });
  useEffect(() => {
    const prev = last.current;
    if (prev.round === view.round) {
      if (outs > prev.outs) play('buzz');
      if (dones > prev.dones) play('coin');
    }
    last.current = { outs, dones, round: view.round };
  }, [outs, dones, view.round]);
  const status = useRef(view.status);
  useEffect(() => {
    if (view.status === 'between' && status.current === 'input' && view.winner) play('fanfare');
    status.current = view.status;
  }, [view.status, view.winner]);
}

function Timer({ view, now, size }: { view: PatternView; now: () => number; size: number }) {
  if (view.status !== 'input') return <div style={{ width: size, height: size }} />;
  return <Countdown key={view.endsAt} endsAt={view.endsAt} now={now} total={inputMs(view.length)} size={size} />;
}

export const patternRecallViews: MinigameViews<PatternView> = {
  HostView({ view, people, now }) {
    const flash = useFlash(view, now);
    useHostSounds(view, flash);
    const after = view.status === 'between' || view.status === 'done';
    return (
      <div className="pr-host">
        <div className="pr-host-side">
          <RoundLine view={view} />
          <Timer view={view} now={now} size={76} />
          {after ? <h2 className="trivia-call pr-call">{resultLine(view, people)}</h2> : <h2 className="pr-phase">{phaseLine(view, now())}</h2>}
          <HostSide view={view} people={people} side="a" />
          <HostSide view={view} people={people} side="b" />
        </div>
        <div className="pr-host-main">
          <Board lit={flash?.lit ?? null} dim={view.status === 'input'} big />
          {after && view.pattern && <PatternRow pattern={view.pattern} />}
          {view.status === 'input' && <p className="lead">Repeat it on your phones!</p>}
        </div>
      </div>
    );
  },

  DuelistView({ view, side, people, send, now }) {
    const flash = useFlash(view, now);
    const [pressed, setPressed] = useState<number | null>(null);
    const timer = useRef<number | undefined>(undefined);
    useEffect(() => () => window.clearTimeout(timer.current), []);
    const going = view.status === 'input' && view.progress[side] === 'going';
    const press = (pad: number) => {
      send({ action: 'press', pad });
      setPressed(pad);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setPressed(null), 180);
    };
    const after = view.status === 'between' || view.status === 'done';
    return (
      <div className="phone-center pr-phone">
        <div className="phone-row">
          <RoundLine view={view} />
          <Timer view={view} now={now} size={52} />
        </div>
        {after ? (
          <div className="phone-big pr-phone-result">{resultLine(view, people, side)}</div>
        ) : (
          <div className="phone-big">{going ? 'Your turn!' : view.status === 'input' ? sideLine(view, side) : phaseLine(view, now())}</div>
        )}
        <Board lit={going ? pressed : (flash?.lit ?? null)} onPress={going ? press : undefined} dim={view.status === 'input' && !going} big />
        <Dots view={view} side={side} />
        {after && view.pattern && <PatternRow pattern={view.pattern} />}
        {view.status === 'input' && !going && view.progress[otherSide(side)] === 'going' && (
          <p className="muted">Waiting for {people[otherSide(side)].name}…</p>
        )}
      </div>
    );
  },

  RefereeView({ view, people, now }) {
    const flash = useFlash(view, now);
    const after = view.status === 'between' || view.status === 'done';
    return (
      <div className="phone-center pr-phone">
        <div className="phone-row">
          <RoundLine view={view} />
          <Timer view={view} now={now} size={52} />
        </div>
        <div className="phone-big">{after ? resultLine(view, people) : phaseLine(view, now())}</div>
        <Board lit={flash?.lit ?? null} dim={view.status === 'input'} />
        {after && view.pattern && <PatternRow pattern={view.pattern} />}
        {SIDES.map((s) => (
          <div key={s} className="pr-ref-side">
            <b>{people[s].name}</b>
            <Dots view={view} side={s} />
            <span className="muted">{sideLine(view, s)}</span>
          </div>
        ))}
        {!after && <p className="muted">The game scores itself. Don’t let anyone call out the colours!</p>}
      </div>
    );
  },
};
