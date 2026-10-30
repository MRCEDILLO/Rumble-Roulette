import { useEffect, useId, useRef } from 'react';
import { Character } from '../../characters/Character';
import { colorById } from '../../characters/looks';
import { play } from '../../sound';
import { Countdown } from '../../ui/common';
import { useTicker } from '../../ui/hooks';
import type { DuelPeople, MinigameViews } from '../types';
import { SNAPOFF_MS, TIME_MS, otherSide, type Card, type CardColor, type Shape, type SnapEvent, type SnapView } from './logic';

type Side = 'a' | 'b';

const INK = '#1b1035';

/** Bold, easy-to-tell colours, so from across the room the trick is in the details, not squinting at shades. */
export const CARD_COLOR: Record<CardColor, string> = {
  red: '#e5383b',
  blue: '#2f6fea',
  green: '#1f9d55',
  yellow: '#f2b705',
  purple: '#8f4de8',
  orange: '#ff7a1a',
};

const star = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 ? 17 : 38;
  const a = (Math.PI / 5) * i - Math.PI / 2;
  return `${50 + r * Math.cos(a)},${53 + r * Math.sin(a)}`;
}).join(' ');

function ShapePath({ shape }: { shape: Shape }) {
  switch (shape) {
    case 'circle':
      return <circle cx="50" cy="50" r="32" />;
    case 'square':
      return <rect x="20" y="20" width="60" height="60" rx="6" />;
    case 'triangle':
      return <polygon points="50,15 86,82 14,82" />;
    case 'star':
      return <polygon points={star} />;
    case 'heart':
      return <path d="M50 84 C22 64 12 48 17 33 C22 18 42 16 50 32 C58 16 78 18 83 33 C88 48 78 64 50 84 Z" />;
    case 'diamond':
      return <polygon points="50,10 82,50 50,90 18,50" />;
  }
}

/** One playing card: a big shape in the middle and small ones in two corners, solid or striped. */
export function CardFace({ card, className }: { card: Card; className?: string }) {
  const id = useId().replace(/:/g, '');
  const color = CARD_COLOR[card.color];
  const paint = card.fill === 'solid' ? color : `url(#${id})`;
  const pip = (x: number, y: number, flip?: boolean) => (
    <g transform={`translate(${x} ${y}) scale(0.17)${flip ? ' rotate(180 50 50)' : ''}`} fill={paint} stroke={color} strokeWidth="10" strokeLinejoin="round">
      <ShapePath shape={card.shape} />
    </g>
  );
  return (
    <svg className={`sn-card${className ? ` ${className}` : ''}`} viewBox="0 0 100 140" aria-label={`${card.color} ${card.fill} ${card.shape}`}>
      <defs>
        <pattern id={id} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="9" height="9" fill="#fff" />
          <rect width="4.5" height="9" fill={color} />
        </pattern>
      </defs>
      <rect x="2" y="2" width="96" height="136" rx="10" fill="#fffdf6" stroke={INK} strokeWidth="4" />
      <rect x="9" y="9" width="82" height="122" rx="6" fill="none" stroke={color} strokeWidth="2" opacity="0.6" />
      {pip(11, 11)}
      {pip(72, 112, true)}
      <g transform="translate(5 25) scale(0.9)" fill={paint} stroke={color} strokeWidth="5" strokeLinejoin="round">
        <ShapePath shape={card.shape} />
      </g>
    </svg>
  );
}

/** The dealer looks different from both duelists, so nobody thinks the dealer is playing. */
const DEALERS = [
  { color: 'white', accessory: 'tophat' },
  { color: 'black', accessory: 'fedora' },
  { color: 'purple', accessory: 'bow' },
];
export const dealerLook = (people: DuelPeople) =>
  DEALERS.find((d) => !(['a', 'b'] as Side[]).some((s) => people[s].color === d.color && people[s].accessory === d.accessory))!;

/** Whether an event happened in the last moment, so its flash is still showing. */
const fresh = (e: SnapEvent | null, now: number, ms = 1_400): e is SnapEvent => !!e && now - e.at < ms;

/** Word joiners keep "5–3" from breaking across lines, and a real minus sign for scores below zero. */
const num = (n: number) => (n < 0 ? `−${-n}` : `${n}`);
const score = (view: SnapView) => `${num(Math.max(view.scores.a, view.scores.b))}⁠–⁠${num(Math.min(view.scores.a, view.scores.b))}`;

function resultLine(view: SnapView, people: DuelPeople, side?: Side) {
  if (view.winner === 'draw') return 'Nobody snapped in sudden death! Play again.';
  const w = view.winner as Side;
  const you = side === w;
  const name = side ? (you ? 'You' : people[w].name) : people[w].name;
  if (view.how === 'snapoff-wrong') {
    const l = otherSide(w);
    const loser = side ? (side === l ? 'You' : people[l].name) : people[l].name;
    return `${loser} snapped wrong in sudden death! ${name} ${you ? 'win' : 'wins'}${side ? (you ? ' 🎉' : ' 😵') : '!'}`;
  }
  if (view.how === 'snapoff') return `${name} ${you ? 'win' : 'wins'} the sudden-death snap!${side ? (you ? ' 🎉' : ' 😵') : ''}`;
  return `${name} ${you ? 'win' : 'wins'} ${score(view)}!${side ? (you ? ' 🎉' : ' 😵') : ''}`;
}

function statusLine(view: SnapView) {
  if (view.status === 'shuffling') return 'The dealer is shuffling…';
  if (view.status === 'snapoff') return 'Tied! Sudden death: next good snap wins!';
  return 'Snap when the two cards match exactly!';
}

const ended = (view: SnapView) => view.status === 'reveal' || view.status === 'done';

function useHostSounds(view: SnapView) {
  const lastDeal = useRef(view.dealt);
  const lastStatus = useRef(view.status);
  const lastAt = useRef({ a: view.last.a?.at ?? 0, b: view.last.b?.at ?? 0 });
  useEffect(() => {
    if (view.dealt > lastDeal.current) play('pop');
    lastDeal.current = view.dealt;
  }, [view.dealt]);
  useEffect(() => {
    for (const s of ['a', 'b'] as Side[]) {
      const e = view.last[s];
      if (e && e.at !== lastAt.current[s]) {
        lastAt.current[s] = e.at;
        if (e.kind === 'snap') play('coin');
        if (e.kind === 'wrong') play('buzz');
      }
    }
  }, [view.last]);
  useEffect(() => {
    if (view.status === 'snapoff' && lastStatus.current !== 'snapoff') play('drum');
    if (view.status === 'reveal' && lastStatus.current !== 'reveal') play('fanfare');
    lastStatus.current = view.status;
  }, [view.status]);
}

function Player({ view, people, side, now }: { view: SnapView; people: DuelPeople; side: Side; now: number }) {
  const p = people[side];
  const e = view.last[side];
  const flash = fresh(e, now) ? e : null;
  const won = ended(view) && view.winner === side;
  const lost = ended(view) && view.winner === otherSide(side);
  const pose = won || flash?.kind === 'snap' ? 'win' : lost || flash?.kind === 'wrong' ? 'lose' : 'idle';
  return (
    <div className={`sn-player sn-player-${side}${won ? ' won' : ''}`} style={{ ['--me' as string]: colorById(p.color).main }}>
      <div className="sn-score">
        <b>{num(view.scores[side])}</b>
        <span className="sn-name">{p.name}</span>
        {flash && (
          <span key={flash.at} className={`sn-pop sn-pop-${flash.kind}`}>
            {flash.kind === 'snap' ? '+1' : flash.kind === 'wrong' ? '−1' : 'Too slow!'}
          </span>
        )}
      </div>
      <div className="sn-body">
        <Character color={p.color} accessory={p.accessory} pose={pose} flip={side === 'b'} size={100} />
      </div>
    </div>
  );
}

/** The wooden card table with green felt and a DEALER sign, shared with Blackjack. */
export function TableTop() {
  return (
    <svg className="sn-table" viewBox="0 0 640 230" preserveAspectRatio="none" aria-hidden="true">
      <rect x="80" y="150" width="26" height="80" rx="6" fill="#5a3420" stroke={INK} strokeWidth="5" />
      <rect x="534" y="150" width="26" height="80" rx="6" fill="#5a3420" stroke={INK} strokeWidth="5" />
      <path d="M60 20 H580 L630 140 H10 Z" fill="#8a5a3b" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
      <path d="M76 32 H564 L606 128 H34 Z" fill="#1f8f4e" />
      <path d="M96 44 H544 L578 116 H62 Z" fill="none" stroke="#5fd08f" strokeWidth="3" strokeDasharray="10 8" opacity="0.6" />
      <rect x="10" y="138" width="620" height="24" rx="6" fill="#6b4029" stroke={INK} strokeWidth="6" />
      <rect x="262" y="166" width="116" height="30" rx="6" fill="#f3d9a4" stroke={INK} strokeWidth="4" />
      <text x="320" y="188" textAnchor="middle" fontSize="18" fontWeight="900" fill={INK} fontFamily="Arial, sans-serif" letterSpacing="3">
        DEALER
      </text>
    </svg>
  );
}

/** The table scene: a duelist at each end, the dealer behind, and the two cards in the middle. */
function Table({ view, people, now }: { view: SnapView; people: DuelPeople; now: number }) {
  const dealer = dealerLook(people);
  const deal = view.deal;
  const snapper = deal?.claimed ?? null;
  const wrong = (['a', 'b'] as Side[]).find((s) => fresh(view.last[s], now, 700) && view.last[s]!.kind === 'wrong' && view.last[s]!.deal === deal?.id);
  return (
    <div className={`sn-stage${view.status === 'snapoff' ? ' sn-sudden' : ''}`}>
      <div className="sn-lamp" />
      <div key={view.dealt} className={`sn-dealer${view.status === 'shuffling' ? ' shuffling' : ''}`}>
        <Character color={dealer.color} accessory={dealer.accessory} pose={ended(view) ? 'still' : 'idle'} size={100} />
      </div>
      <TableTop />
      <div className="sn-deck">
        <CardBack />
        <CardBack />
        <CardBack />
      </div>
      <div data-deal={deal?.id ?? 0} className={`sn-cards${snapper ? ' claimed' : ''}${wrong ? ' wrong' : ''}`}>
        {deal ? (
          <>
            <div key={`l${deal.id}`} className="sn-slot sn-left">
              <CardFace card={deal.left} />
            </div>
            <div key={`r${deal.id}`} className="sn-slot sn-right">
              <CardFace card={deal.right} />
            </div>
          </>
        ) : (
          <>
            <div className="sn-slot sn-empty" />
            <div className="sn-slot sn-empty" />
          </>
        )}
        {snapper && (
          <div key={`s${deal!.id}`} className="sn-burst" style={{ ['--me' as string]: colorById(people[snapper].color).main }}>
            SNAP!
            <small>{people[snapper].name}</small>
          </div>
        )}
        {wrong && !snapper && (
          <div key={`w${view.last[wrong]!.at}`} className="sn-nope">
            ✗ Not a match!
            <small>{people[wrong].name} −1</small>
          </div>
        )}
      </div>
      <Player view={view} people={people} side="a" now={now} />
      <Player view={view} people={people} side="b" now={now} />
    </div>
  );
}

function CardBack() {
  return (
    <svg className="sn-back" viewBox="0 0 100 140" aria-hidden="true">
      <rect x="2" y="2" width="96" height="136" rx="10" fill="#d6336c" stroke={INK} strokeWidth="4" />
      <rect x="11" y="11" width="78" height="118" rx="6" fill="none" stroke="#fff" strokeWidth="3" opacity="0.7" />
      <path d="M50 40 L66 70 L50 100 L34 70 Z" fill="#fff" opacity="0.85" />
    </svg>
  );
}

function Timer({ view, now, size }: { view: SnapView; now: () => number; size: number }) {
  if (view.status === 'playing') return <Countdown key={view.endsAt} endsAt={view.endsAt} now={now} total={TIME_MS} size={size} />;
  if (view.status === 'snapoff') return <Countdown key={view.endsAt} endsAt={view.endsAt} now={now} total={SNAPOFF_MS} size={size} />;
  return null;
}

/** What the duelist's last snap did, while it's still fresh. */
function feedback(e: SnapEvent | null, now: number) {
  if (!fresh(e, now, 1_600)) return null;
  if (e.kind === 'snap') return { cls: 'good', text: 'SNAP! +1 🎉' };
  if (e.kind === 'wrong') return { cls: 'bad', text: 'Not a match! −1' };
  return { cls: 'late', text: 'Too slow! 🐢' };
}

export const snapViews: MinigameViews<SnapView> = {
  HostView({ view, people, now }) {
    useHostSounds(view);
    useTicker(100);
    return (
      <div className="sn-host">
        <div className="sn-top">
          <Timer view={view} now={now} size={76} />
          <h2 className="trivia-call">{ended(view) ? resultLine(view, people) : statusLine(view)}</h2>
        </div>
        <Table view={view} people={people} now={now()} />
      </div>
    );
  },

  DuelistView({ view, side, people, send, now }) {
    useTicker(100);
    const other = otherSide(side);
    const live = view.status === 'playing' || view.status === 'snapoff';
    const fb = feedback(view.last[side], now());
    return (
      <div className="phone-center sn-phone">
        <div className="phone-row">
          <div className="mf-scores">
            <span className="st-badge sn-badge" style={{ borderColor: colorById(people[side].color).main }}>
              You: {num(view.scores[side])}
            </span>
            <span className="st-badge sn-badge" style={{ borderColor: colorById(people[other].color).main }}>
              {people[other].name}: {num(view.scores[other])}
            </span>
          </div>
          <Timer view={view} now={now} size={52} />
        </div>
        {ended(view) ? (
          <div className="phone-big">{resultLine(view, people, side)}</div>
        ) : (
          <>
            <div className={`sn-feedback ${fb?.cls ?? ''}`}>{fb?.text ?? (view.status === 'snapoff' ? 'Sudden death! One snap decides it.' : live ? 'Watch the big screen…' : 'Get ready…')}</div>
            <button
              className="buzzer sn-buzzer"
              disabled={!live}
              onPointerDown={(ev) => {
                ev.preventDefault();
                navigator.vibrate?.(40);
                send({ action: 'snap', deal: view.deal?.id });
              }}
            >
              SNAP!
            </button>
            <p className="muted">Only when the two cards match exactly. A wrong snap costs a point!</p>
          </>
        )}
      </div>
    );
  },

  RefereeView({ view, people, now }) {
    useTicker(100);
    return (
      <div className="phone-center sn-phone">
        <div className="phone-row">
          <div className="phone-big">{ended(view) ? resultLine(view, people) : view.status === 'snapoff' ? 'Sudden death!' : 'Snap!'}</div>
          <Timer view={view} now={now} size={52} />
        </div>
        <div className="sn-phone-cards">
          {view.deal ? (
            <>
              <CardFace card={view.deal.left} />
              <CardFace card={view.deal.right} />
            </>
          ) : (
            <p className="muted">Shuffling…</p>
          )}
        </div>
        <div className="mf-scores">
          {(['a', 'b'] as Side[]).map((s) => (
            <span key={s} className="st-badge sn-badge" style={{ borderColor: colorById(people[s].color).main }}>
              {people[s].name}: {num(view.scores[s])}
            </span>
          ))}
        </div>
        {!ended(view) && <p className="muted">The game scores itself. Just watch!</p>}
      </div>
    );
  },
};
