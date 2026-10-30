import { useEffect, useRef } from 'react';
import { Character } from '../../characters/Character';
import { play } from '../../sound';
import { Countdown } from '../../ui/common';
import { TILE_COLOR } from '../stack-toe/views';
import type { DuelPeople, MinigameViews } from '../types';
import { COLS, PAIRS, TURN_MS, otherSide, type MemoryFlipView, type Shape } from './logic';

type Side = 'a' | 'b';

/** Each shape has its own colour too, so cards can be told apart at a glance from across the room. */
const SHAPE_COLOR: Record<Shape, string> = {
  circle: '#ff5a3c',
  square: '#2f8cff',
  triangle: '#20b25a',
  star: '#ffc21a',
  heart: '#ff5fa2',
  diamond: '#8b5cf6',
  hexagon: '#ff8a1f',
  cross: '#14b8b8',
};

const star = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 ? 19 : 42;
  const a = (Math.PI / 5) * i - Math.PI / 2;
  return `${50 + r * Math.cos(a)},${54 + r * Math.sin(a)}`;
}).join(' ');

const hexagon = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 3) * i;
  return `${50 + 40 * Math.cos(a)},${50 + 40 * Math.sin(a)}`;
}).join(' ');

function ShapeArt({ shape, px }: { shape: Shape; px: number }) {
  const art: Record<Shape, React.ReactNode> = {
    circle: <circle cx="50" cy="50" r="36" />,
    square: <rect x="16" y="16" width="68" height="68" rx="8" />,
    triangle: <polygon points="50,12 90,84 10,84" strokeLinejoin="round" />,
    star: <polygon points={star} strokeLinejoin="round" />,
    heart: <path d="M50 86 C20 64 8 46 14 30 C20 14 42 12 50 30 C58 12 80 14 86 30 C92 46 80 64 50 86 Z" />,
    diamond: <polygon points="50,8 86,50 50,92 14,50" strokeLinejoin="round" />,
    hexagon: <polygon points={hexagon} strokeLinejoin="round" />,
    cross: <polygon points="38,12 62,12 62,38 88,38 88,62 62,62 62,88 38,88 38,62 12,62 12,38 38,38" strokeLinejoin="round" />,
  };
  return (
    <svg className="mf-shape" viewBox="0 0 100 100" width={px} height={px} fill={SHAPE_COLOR[shape]} aria-label={shape}>
      {art[shape]}
    </svg>
  );
}

function Grid({ view, px, onCard }: { view: MemoryFlipView; px: number; onCard?: (card: number) => void }) {
  const card = Math.floor((px - 6 * (COLS + 1)) / COLS);
  return (
    <div className="mf-grid" style={{ gridTemplateColumns: `repeat(${COLS}, ${card}px)` }}>
      {view.cards.map((c, i) => {
        const open = !!onCard && !c.up;
        const fresh = c.up && !c.taken;
        const cls = ['mf-card', c.up && 'up', c.taken && `mf-taken mf-${c.taken}`, fresh && 'fresh', open && 'open'].filter(Boolean).join(' ');
        return (
          <button key={i} className={cls} style={{ width: card, height: card }} disabled={!open} onClick={() => onCard?.(i)} aria-label={c.shape ?? `Card ${i + 1}`}>
            <span className="mf-inner">
              <span className="mf-back" />
              <span className="mf-front">{c.shape && <ShapeArt shape={c.shape} px={card * 0.72} />}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function resultLine(view: MemoryFlipView, people: DuelPeople, side?: Side) {
  const { a, b } = view.pairs;
  if (view.winner === 'draw') return `${a}–${b}: it’s a tie, play again!`;
  const w = view.winner as Side;
  const score = `${Math.max(a, b)}–${Math.min(a, b)}`;
  if (side) return w === side ? `You win ${score}! 🎉` : `${people[w].name} wins ${score} 😵`;
  return `${people[w].name} wins ${score}!`;
}

function turnLine(view: MemoryFlipView, people: DuelPeople, side?: Side) {
  const who = side ? (view.turn === side ? 'You' : people[view.turn].name) : people[view.turn].name;
  if (view.status === 'showing') {
    if (view.last?.match) return `${who} found a pair! 🎯`;
    return view.last?.auto ? 'Time’s up! No match…' : 'No match…';
  }
  if (side) return view.turn === side ? (view.last?.match ? 'Pair! Go again!' : 'Your turn: flip two cards!') : `${who}’s turn…`;
  return view.last?.match ? `${who} goes again!` : `${who}’s turn`;
}

function useHostSounds(view: MemoryFlipView) {
  const up = view.cards.filter((c) => c.up).length;
  const lastUp = useRef(up);
  const last = useRef(view.status);
  useEffect(() => {
    if (up > lastUp.current) play('pop');
    lastUp.current = up;
  }, [up]);
  useEffect(() => {
    if (view.status === 'showing' && last.current === 'playing') play(view.last?.match ? 'coin' : 'buzz');
    if (view.status === 'reveal' && last.current !== 'reveal') play('fanfare');
    last.current = view.status;
  }, [view.status, view.last]);
}

function Score({ view, side }: { view: MemoryFlipView; side: Side }) {
  return (
    <div className="mf-score">
      <b>{view.pairs[side]}</b>
      <small>{view.pairs[side] === 1 ? 'pair' : 'pairs'}</small>
    </div>
  );
}

function HostSide({ view, people, side }: { view: MemoryFlipView; people: DuelPeople; side: Side }) {
  const p = people[side];
  const ended = view.status === 'reveal' || view.status === 'done';
  const won = ended && view.winner === side;
  const lost = ended && view.winner === otherSide(side);
  const turn = !ended && view.turn === side;
  return (
    <div className={`st-side st-side-${side}${won ? ' won' : ''}${turn ? ' turn' : ''}`}>
      <Character color={p.color} accessory={p.accessory} size={90} flip={side === 'b'} pose={won ? 'win' : lost ? 'lose' : 'idle'} />
      <div className="big-name">{p.name}</div>
      <div className={`st-badge st-${side}`}>
        {TILE_COLOR[side]}
        {view.first === side ? ' · went first' : ''}
      </div>
      <Score view={view} side={side} />
    </div>
  );
}

const ended = (view: MemoryFlipView) => view.status === 'reveal' || view.status === 'done';

export const memoryFlipViews: MinigameViews<MemoryFlipView> = {
  HostView({ view, people, now }) {
    useHostSounds(view);
    const playing = view.status === 'playing';
    return (
      <div className="st-host">
        <div className="hm-center">
          {playing && <Countdown key={view.turnEndsAt} endsAt={view.turnEndsAt} now={now} total={TURN_MS} size={80} />}
          <h2 className="trivia-call">{ended(view) ? resultLine(view, people) : turnLine(view, people)}</h2>
        </div>
        <div className="st-arena">
          <HostSide view={view} people={people} side="a" />
          <Grid view={view} px={460} />
          <HostSide view={view} people={people} side="b" />
        </div>
      </div>
    );
  },

  DuelistView({ view, side, people, send, now }) {
    const other = otherSide(side);
    const mine = view.status === 'playing' && view.turn === side;
    return (
      <div className="phone-center st-phone">
        <div className="phone-row">
          <span className={`st-badge st-${side}`}>You’re {TILE_COLOR[side]}</span>
          {view.status === 'playing' && <Countdown key={view.turnEndsAt} endsAt={view.turnEndsAt} now={now} total={TURN_MS} size={52} />}
        </div>
        <div className="phone-big st-turn">{ended(view) ? resultLine(view, people, side) : turnLine(view, people, side)}</div>
        <Grid view={view} px={300} onCard={mine ? (card) => send({ action: 'flip', card }) : undefined} />
        <div className="mf-scores">
          <span className={`st-badge st-${side}`}>You: {view.pairs[side]}</span>
          <span className={`st-badge st-${other}`}>
            {people[other].name}: {view.pairs[other]}
          </span>
        </div>
        {!ended(view) && <p className="muted st-hint">{mine ? 'Tap two cards to flip them.' : 'Watch the cards and remember!'}</p>}
      </div>
    );
  },

  RefereeView({ view, people, now }) {
    const playing = view.status === 'playing';
    return (
      <div className="phone-center st-phone">
        <div className="phone-row">
          <div className="phone-big">{ended(view) ? resultLine(view, people) : turnLine(view, people)}</div>
          {playing && <Countdown key={view.turnEndsAt} endsAt={view.turnEndsAt} now={now} total={TURN_MS} size={52} />}
        </div>
        <Grid view={view} px={300} />
        <div className="mf-scores">
          {(['a', 'b'] as Side[]).map((s) => (
            <span key={s} className={`st-badge st-${s}`}>
              {people[s].name}: {view.pairs[s]}
            </span>
          ))}
        </div>
        {!ended(view) && <p className="muted">{PAIRS} pairs in all. The game scores itself. Just watch!</p>}
      </div>
    );
  },
};
