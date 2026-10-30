import { useEffect, useRef, type CSSProperties, type JSX } from 'react';
import { Character } from '../../characters/Character';
import { colorById } from '../../characters/looks';
import { play } from '../../sound';
import { Countdown } from '../../ui/common';
import { TableTop, dealerLook } from '../snap/views';
import type { DuelPeople, MinigameViews } from '../types';
import { CHOOSE_MS, handTotal, isActive, isBust, otherSide, type BlackjackView, type Card, type Hand, type Suit } from './logic';

type Side = 'a' | 'b';

const INK = '#1b1035';
const RED = '#d62839';
const suitColor = (s: Suit) => (s === 'hearts' || s === 'diamonds' ? RED : INK);

/** Each suit drawn in a 100×100 box. */
function SuitShape({ suit }: { suit: Suit }) {
  switch (suit) {
    case 'hearts':
      return <path d="M50 90 C20 68 6 50 12 32 C18 14 42 12 50 32 C58 12 82 14 88 32 C94 50 80 68 50 90 Z" />;
    case 'diamonds':
      return <polygon points="50,6 86,50 50,94 14,50" />;
    case 'spades':
      return <path d="M50 6 C24 32 8 46 12 62 C16 78 38 80 46 68 L40 94 H60 L54 68 C62 80 84 78 88 62 C92 46 76 32 50 6 Z" />;
    case 'clubs':
      return (
        <>
          <circle cx="50" cy="28" r="20" />
          <circle cx="27" cy="58" r="20" />
          <circle cx="73" cy="58" r="20" />
          <circle cx="50" cy="52" r="12" />
          <polygon points="45,56 38,94 62,94 55,56" />
        </>
      );
  }
}

/** Where the suit symbols go on the number cards, like a real deck. Points below the middle are drawn upside down. */
const L = 36;
const R = 64;
const M = 50;
const PIPS: Record<string, [number, number][]> = {
  A: [[M, 70]],
  '2': [[M, 32], [M, 108]],
  '3': [[M, 32], [M, 70], [M, 108]],
  '4': [[L, 32], [R, 32], [L, 108], [R, 108]],
  '5': [[L, 32], [R, 32], [M, 70], [L, 108], [R, 108]],
  '6': [[L, 32], [R, 32], [L, 70], [R, 70], [L, 108], [R, 108]],
  '7': [[L, 32], [R, 32], [M, 51], [L, 70], [R, 70], [L, 108], [R, 108]],
  '8': [[L, 32], [R, 32], [M, 51], [L, 70], [R, 70], [M, 89], [L, 108], [R, 108]],
  '9': [[L, 32], [R, 32], [L, 57], [R, 57], [M, 70], [L, 83], [R, 83], [L, 108], [R, 108]],
  '10': [[L, 32], [R, 32], [M, 44], [L, 57], [R, 57], [L, 83], [R, 83], [M, 96], [L, 108], [R, 108]],
};

/** A simple drawn crown (King), tiara (Queen) or feathered cap (Jack) for the picture cards. */
function Royal({ rank, color }: { rank: 'J' | 'Q' | 'K'; color: string }) {
  const art: Record<'J' | 'Q' | 'K', JSX.Element> = {
    K: <path d="M30 62 L26 34 L40 48 L50 28 L60 48 L74 34 L70 62 Z" fill="#ffc21a" />,
    Q: (
      <>
        <path d="M30 62 C30 46 38 40 50 40 C62 40 70 46 70 62 Z" fill="#ffc21a" />
        <circle cx="50" cy="34" r="6" fill={color} />
      </>
    ),
    J: (
      <>
        <path d="M28 62 C28 46 36 40 50 40 C64 40 72 46 72 62 Z" fill={color} />
        <path d="M60 42 C66 26 80 22 86 26 C78 30 72 38 68 48 Z" fill="#ffc21a" />
      </>
    ),
  };
  return (
    <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
      <rect x="20" y="22" width="60" height="96" rx="6" fill="#fff4d6" stroke={color} />
      {art[rank]}
      <text x="50" y="104" textAnchor="middle" fontSize="40" fontWeight="900" fill={color} stroke="none" fontFamily="Arial, sans-serif">
        {rank}
      </text>
    </g>
  );
}

const SUIT_CHAR: Record<Suit, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };

/** One of the 52 cards: rank and suit in two corners, and the pips (or a picture) in the middle. */
export function PlayingCard({ card, className, style }: { card: Card; className?: string; style?: CSSProperties }) {
  const color = suitColor(card.suit);
  const pip = (x: number, y: number, size: number, key?: number, flip = y > 70) => (
    <g key={key} transform={`translate(${x - size / 2} ${y - size / 2}) scale(${size / 100})${flip ? ' rotate(180 50 50)' : ''}`} fill={color}>
      <SuitShape suit={card.suit} />
    </g>
  );
  const corner = (flip: boolean) => (
    <g transform={flip ? 'rotate(180 50 70)' : undefined}>
      <text x="13" y="24" textAnchor="middle" fontSize={card.rank === '10' ? 17 : 21} fontWeight="900" fill={color} fontFamily="Arial, sans-serif" letterSpacing={card.rank === '10' ? -1.5 : 0}>
        {card.rank}
      </text>
      <g transform="translate(6.5 28) scale(0.13)" fill={color}>
        <SuitShape suit={card.suit} />
      </g>
    </g>
  );
  const face = card.rank === 'J' || card.rank === 'Q' || card.rank === 'K';
  return (
    <svg className={`bj-card${className ? ` ${className}` : ''}`} style={style} viewBox="0 0 100 140" role="img" aria-label={`${card.rank} of ${card.suit}`}>
      <rect x="2" y="2" width="96" height="136" rx="10" fill="#fffdf6" stroke={INK} strokeWidth="4" />
      {corner(false)}
      {corner(true)}
      {face ? (
        <>
          <Royal rank={card.rank as 'J' | 'Q' | 'K'} color={color} />
          {pip(29, 106, 11, 0, false)}
          {pip(71, 106, 11, 1, false)}
        </>
      ) : card.rank === 'A' ? (
        pip(50, 70, 46)
      ) : (
        PIPS[card.rank].map(([x, y], i) => pip(x, y, 18, i))
      )}
      <title>{`${card.rank}${SUIT_CHAR[card.suit]}`}</title>
    </svg>
  );
}

export function BlackjackBack({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg className={`bj-back${className ? ` ${className}` : ''}`} style={style} viewBox="0 0 100 140" aria-hidden="true">
      <rect x="2" y="2" width="96" height="136" rx="10" fill="#1f5fbf" stroke={INK} strokeWidth="4" />
      <rect x="11" y="11" width="78" height="118" rx="6" fill="none" stroke="#fff" strokeWidth="3" opacity="0.7" />
      <path d="M50 30 L72 70 L50 110 L28 70 Z" fill="#fff" opacity="0.85" />
      <path d="M50 48 L62 70 L50 92 L38 70 Z" fill="#1f5fbf" />
    </svg>
  );
}

/** "17", or "7 / 17" while an Ace could still count either way. */
export function totalText(h: Hand, view?: BlackjackView, hidden = false) {
  // Wait for the cards to land before giving the total away.
  if (view?.status === 'dealing') return '…';
  if (view && hidden && !faceUp(view)) return '?';
  const { total, soft } = handTotal(h.cards);
  return soft && total < 21 ? `${total - 10} / ${total}` : `${total}`;
}

const ended = (view: BlackjackView) => view.status === 'reveal' || view.status === 'done';
/**
 * Hands stay face down on the big screen and the other duelist's phone, so nobody can play to the
 * other hand. Both are turned over once the hand is settled.
 */
const faceUp = (view: BlackjackView) => view.status === 'push' || ended(view);

/** What a duelist is up to right now, as one short tag. A `hidden` hand never gives its 21 away. */
function tag(view: BlackjackView, side: Side, hidden = false): { cls: string; text: string } | null {
  if (view.status === 'dealing') return null;
  const h = view.hands[side];
  const total = handTotal(h.cards).total;
  if (isBust(h)) return { cls: 'bust', text: 'BUST!' };
  if (view.status === 'showing' && view.shown[side]) {
    const c = view.shown[side]!;
    return { cls: c, text: c === 'hit' ? 'HIT!' : view.timedOut[side] ? 'STAND (time!)' : 'STAND' };
  }
  if (total === 21 && !(hidden && !faceUp(view))) return { cls: 'twentyone', text: h.cards.length === 2 ? 'BLACKJACK!' : '21!' };
  if (h.stood) return { cls: 'stand', text: 'STAND' };
  if (view.status === 'choosing') return view.locked[side] ? { cls: 'locked', text: '✓ Locked in' } : { cls: 'thinking', text: 'Thinking…' };
  return null;
}

/** The headline once a hand is settled. `side` words it for that duelist's own phone. */
function resultLine(view: BlackjackView, people: DuelPeople, side?: Side) {
  const w = view.winner as Side;
  const l = otherSide(w);
  const you = side === w;
  const name = (s: Side) => (side === s ? 'You' : people[s].name);
  const wins = `${name(w)} ${you ? 'win' : 'wins'}`;
  const emoji = side ? (you ? ' 🎉' : ' 😵') : '!';
  if (isBust(view.hands[l])) return `${name(l)} ${side === l ? 'bust' : 'busts'} on ${handTotal(view.hands[l].cards).total}! ${wins}${emoji}`;
  return `${wins} ${handTotal(view.hands[w].cards).total} to ${handTotal(view.hands[l].cards).total}${emoji}`;
}

function pushLine(view: BlackjackView) {
  if (isBust(view.hands.a) && isBust(view.hands.b)) return 'Both bust! New hand…';
  return `Push! Both on ${handTotal(view.hands.a.cards).total}. New hand…`;
}

function statusLine(view: BlackjackView, people: DuelPeople) {
  if (ended(view)) return resultLine(view, people);
  if (view.status === 'push') return pushLine(view);
  if (view.status === 'dealing') return view.hand > 1 ? `Hand ${view.hand}: the dealer deals again…` : 'The dealer deals…';
  if (view.status === 'showing') return 'The picks are in!';
  const waiting = (['a', 'b'] as Side[]).filter((s) => isActive(view.hands[s]));
  if (waiting.length === 1) return `${people[waiting[0]].name}: hit or stand?`;
  return 'Hit or stand? Pick on your phone!';
}

function useHostSounds(view: BlackjackView) {
  const cards = view.hands.a.cards.length + view.hands.b.cards.length;
  const last = useRef({ cards, status: view.status, hand: view.hand });
  useEffect(() => {
    const was = last.current;
    if (view.hand !== was.hand || cards > was.cards) play('pop');
    if (view.status === 'showing' && was.status !== 'showing') play('reveal');
    if ((isBust(view.hands.a) || isBust(view.hands.b)) && cards > was.cards) play('buzz');
    if (view.status === 'push' && was.status !== 'push') play('drum');
    if (view.status === 'reveal' && was.status !== 'reveal') play('fanfare');
    last.current = { cards, status: view.status, hand: view.hand };
  }, [cards, view.status, view.hand, view.hands]);
}

/** A fanned-out hand. On the first deal the cards fly in one at a time, a, b, a, b. */
/** `secret` hands are face down until the hand is settled, then turn over. */
function HandCards({ hand, side, dealing, secret = false, view, className }: { hand: Hand; side: Side; dealing: boolean; secret?: boolean; view?: BlackjackView; className?: string }) {
  const hidden = secret && !!view && !faceUp(view);
  const n = hand.cards.length;
  return (
    <div className={`bj-hand${isBust(hand) && !hidden ? ' bust' : ''}${className ? ` ${className}` : ''}`} style={{ ['--n' as string]: n }}>
      {hand.cards.map((card, i) => {
        const style = { ['--i' as string]: i, animationDelay: dealing && i < 2 ? `${(i * 2 + (side === 'b' ? 1 : 0)) * 0.45}s` : undefined };
        if (hidden) return <BlackjackBack key={`b${i}`} className="bj-card bj-dealt" style={style} />;
        return <PlayingCard key={`f${i}`} card={card} className={secret ? 'bj-flip' : 'bj-dealt'} style={style} />;
      })}
    </div>
  );
}

function Seat({ view, people, side }: { view: BlackjackView; people: DuelPeople; side: Side }) {
  const p = people[side];
  const won = ended(view) && view.winner === side;
  const lost = ended(view) && view.winner === otherSide(side);
  const t = tag(view, side, true);
  const pose = won ? 'win' : lost || isBust(view.hands[side]) ? 'lose' : 'idle';
  return (
    <div className={`sn-player sn-player-${side}${won ? ' won' : ''}`} style={{ ['--me' as string]: colorById(p.color).main }}>
      <div className="sn-score">
        <b className={isBust(view.hands[side]) ? 'bj-bust-total' : undefined}>{totalText(view.hands[side], view, true)}</b>
        <span className="sn-name">{p.name}</span>
        {t && (
          <span key={t.text} className={`bj-tag bj-tag-${t.cls}`}>
            {t.text}
          </span>
        )}
      </div>
      <div className="sn-body">
        <Character color={p.color} accessory={p.accessory} pose={pose} flip={side === 'b'} size={100} />
      </div>
    </div>
  );
}

/** The Snap! table again: a duelist at each end, the dealer behind, and both hands face down on the felt. */
function Table({ view, people }: { view: BlackjackView; people: DuelPeople }) {
  const dealer = dealerLook(people);
  const dealing = view.status === 'dealing';
  return (
    <div className="sn-stage bj-stage">
      <div className="sn-lamp" />
      <div className={`sn-dealer${dealing ? ' shuffling' : ''}`}>
        <Character color={dealer.color} accessory={dealer.accessory} pose={ended(view) ? 'still' : 'idle'} size={100} />
      </div>
      <TableTop />
      <div className="bj-deck">
        <BlackjackBack />
        <BlackjackBack />
        <BlackjackBack />
      </div>
      <div key={view.hand} className="bj-hands">
        <HandCards hand={view.hands.a} side="a" dealing={dealing} secret view={view} className="bj-hand-a" />
        <HandCards hand={view.hands.b} side="b" dealing={dealing} secret view={view} className="bj-hand-b" />
      </div>
      {view.status === 'push' && (
        <div className="sn-nope bj-push">
          PUSH!
          <small>{isBust(view.hands.a) && isBust(view.hands.b) ? 'Both bust' : 'Tied'}: new hand coming</small>
        </div>
      )}
      <Seat view={view} people={people} side="a" />
      <Seat view={view} people={people} side="b" />
    </div>
  );
}

function Timer({ view, now, size }: { view: BlackjackView; now: () => number; size: number }) {
  if (view.status !== 'choosing') return null;
  return <Countdown key={`${view.hand}-${view.turn}`} endsAt={view.until} now={now} total={CHOOSE_MS} size={size} />;
}

/** What the duelist's own phone says under the buttons (or in place of them). */
function myLine(view: BlackjackView, side: Side, people: DuelPeople) {
  const me = view.hands[side];
  const them = people[otherSide(side)].name;
  const total = handTotal(me.cards).total;
  if (view.status === 'push') return pushLine(view);
  if (view.status === 'dealing') return 'Dealing…';
  if (isBust(me)) return `Bust on ${total}! 😵`;
  if (view.status === 'showing') {
    const mine = view.shown[side];
    const theirs = view.shown[otherSide(side)];
    const say = (c: string | null) => (c === 'hit' ? 'HIT' : 'STAND');
    if (mine && theirs) return `You: ${say(mine)} · ${them}: ${say(theirs)}`;
    if (mine) return `You picked ${say(mine)}.`;
    return `${them} picked ${say(theirs)}.`;
  }
  if (total === 21) return me.cards.length === 2 ? 'Blackjack! You’re on 21.' : 'You’re on 21!';
  if (me.stood) return `You’re standing on ${total}.`;
  if (view.locked[side]) return `Locked in. Waiting for ${them}…`;
  return '';
}

export const blackjackViews: MinigameViews<BlackjackView> = {
  HostView({ view, people, now }) {
    useHostSounds(view);
    return (
      <div className="sn-host">
        <div className="sn-top">
          <Timer view={view} now={now} size={76} />
          <h2 className="trivia-call">{statusLine(view, people)}</h2>
        </div>
        <Table view={view} people={people} />
      </div>
    );
  },

  DuelistView({ view, side, people, send, now }) {
    const other = otherSide(side);
    const me = view.hands[side];
    const canPick = view.status === 'choosing' && isActive(me) && !view.locked[side];
    const t = tag(view, other, true);
    return (
      <div className="phone-center bj-phone">
        <div className="phone-row">
          <div className="phone-big">{ended(view) ? 'Result' : `Hand ${view.hand}`}</div>
          <Timer view={view} now={now} size={52} />
        </div>
        <div className="bj-phone-them" style={{ borderColor: colorById(people[other].color).main }}>
          <div className="bj-phone-who">
            <b>{people[other].name}</b>
            <span>{totalText(view.hands[other], view, true)}</span>
            {t && <span className={`bj-tag bj-tag-${t.cls}`}>{t.text}</span>}
          </div>
          <HandCards hand={view.hands[other]} side={other} dealing={false} secret view={view} className="bj-hand-small" />
        </div>
        <div className="bj-phone-me" style={{ borderColor: colorById(people[side].color).main }}>
          <HandCards key={view.hand} hand={me} side={side} dealing={false} className="bj-hand-mine" />
          <div className={`bj-my-total${isBust(me) ? ' bust' : ''}`}>{totalText(me, view)}</div>
        </div>
        {ended(view) ? (
          <div className="phone-big">{resultLine(view, people, side)}</div>
        ) : canPick ? (
          <div className="bj-buttons">
            <button className="bj-btn bj-hit" onClick={() => (navigator.vibrate?.(30), send({ choice: 'hit', turn: view.turn }))}>
              HIT
              <small>take a card</small>
            </button>
            <button className="bj-btn bj-stand" onClick={() => (navigator.vibrate?.(30), send({ choice: 'stand', turn: view.turn }))}>
              STAND
              <small>stop here</small>
            </button>
          </div>
        ) : (
          <div className="bj-wait">{myLine(view, side, people)}</div>
        )}
        {canPick && <p className="muted">{people[other].name} can’t see your pick until you’ve both chosen.</p>}
      </div>
    );
  },

  RefereeView({ view, people, now }) {
    return (
      <div className="phone-center bj-phone">
        <div className="phone-row">
          <div className="phone-big">{ended(view) ? resultLine(view, people) : view.status === 'push' ? pushLine(view) : 'Blackjack'}</div>
          <Timer view={view} now={now} size={52} />
        </div>
        {(['a', 'b'] as Side[]).map((s) => {
          const t = tag(view, s);
          return (
            <div key={s} className="bj-phone-them" style={{ borderColor: colorById(people[s].color).main }}>
              <div className="bj-phone-who">
                <b>{people[s].name}</b>
                <span>{totalText(view.hands[s], view)}</span>
                {t && <span className={`bj-tag bj-tag-${t.cls}`}>{t.text}</span>}
              </div>
              <HandCards hand={view.hands[s]} side={s} dealing={false} className="bj-hand-small" />
            </div>
          );
        })}
        {!ended(view) && <p className="muted">The game scores itself. Just watch the poker faces!</p>}
      </div>
    );
  },
};
