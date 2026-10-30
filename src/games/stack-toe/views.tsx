import { useEffect, useRef, useState } from 'react';
import { Character } from '../../characters/Character';
import { play } from '../../sound';
import { Countdown } from '../../ui/common';
import type { DuelPeople, MinigameViews } from '../types';
import { SIZES, SIZE_NAME, TILES_PER_SIZE, TURN_MS, canPlace, otherSide, type Size, type StackToeView, type Tile } from './logic';

type Side = 'a' | 'b';

/** Duelists can share a character colour, so the tiles always use the same two colours. */
export const TILE_COLOR: Record<Side, string> = { a: 'Red', b: 'Blue' };

/** One tile: bigger tiles fill more of the square, and the dots say the size too. */
export function TileShape({ tile, px }: { tile: Tile; px: number }) {
  const scale = [0, 0.44, 0.66, 0.9][tile.size];
  const s = 100 * scale;
  const o = (100 - s) / 2;
  const dots = tile.size === 1 ? [50] : tile.size === 2 ? [42, 58] : [36, 50, 64];
  return (
    <svg className={`st-tile st-${tile.owner}`} viewBox="0 0 100 100" width={px} height={px} aria-label={`${TILE_COLOR[tile.owner]} ${SIZE_NAME[tile.size]}`}>
      <rect x={o} y={o} width={s} height={s} rx={s * 0.22} className="st-tile-body" />
      <rect x={o + s * 0.14} y={o + s * 0.14} width={s * 0.72} height={s * 0.72} rx={s * 0.16} className="st-tile-face" />
      {dots.map((x) => (
        <circle key={x} cx={x} cy="50" r={3.4} className="st-tile-dot" />
      ))}
    </svg>
  );
}

function BoardGrid({
  view,
  px,
  pick,
  onCell,
}: {
  view: StackToeView;
  px: number;
  /** The size this phone is about to place: squares it fits on light up. */
  pick?: Size | null;
  onCell?: (cell: number) => void;
}) {
  const cell = Math.floor(px / 3);
  return (
    <div className="st-board" style={{ gridTemplateColumns: `repeat(3, ${cell}px)` }}>
      {view.cells.map((c, i) => {
        const open = !!onCell && !!pick && canPlace(c.top ? [c.top] : [], pick);
        const cls = ['st-cell', open && 'open', view.winLine?.includes(i) && 'win', view.last?.cell === i && 'last'].filter(Boolean).join(' ');
        return (
          <button key={i} className={cls} style={{ width: cell, height: cell }} disabled={!open} onClick={() => onCell?.(i)} aria-label={`Square ${i + 1}`}>
            {c.top && <TileShape tile={c.top} px={cell - 10} />}
            {c.under > 0 && <span className="st-under">+{c.under}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** The tiles a duelist still has, by size. Tappable on their own phone. */
function Hand({
  view,
  side,
  px,
  pick,
  onPick,
}: {
  view: StackToeView;
  side: Side;
  px: number;
  pick?: Size | null;
  onPick?: (size: Size) => void;
}) {
  return (
    <div className="st-hand">
      {SIZES.map((size) => {
        const n = view.left[side][size];
        const cls = ['st-hand-slot', pick === size && 'picked', n === 0 && 'empty'].filter(Boolean).join(' ');
        const body = (
          <>
            <TileShape tile={{ owner: side, size }} px={px} />
            <span className="st-count">
              {n}/{TILES_PER_SIZE}
            </span>
          </>
        );
        return onPick ? (
          <button key={size} className={`btn ${cls}`} disabled={n === 0} onClick={() => onPick(size)} aria-label={`${SIZE_NAME[size]}, ${n} left`}>
            {body}
          </button>
        ) : (
          <div key={size} className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

function resultLine(view: StackToeView, people: DuelPeople, side?: Side) {
  if (view.winner === 'draw') return 'No moves left: it’s a draw!';
  const w = view.winner as Side;
  if (side) return w === side ? 'Three in a row! You win! 🎉' : `${people[w].name} got three in a row 😵`;
  return `${people[w].name} gets three in a row!`;
}

function turnLine(view: StackToeView, people: DuelPeople) {
  const p = people[view.turn].name;
  return view.last?.auto ? `Time’s up, a tile went down at random. ${p}’s turn` : `${p}’s turn (${TILE_COLOR[view.turn]})`;
}

function useHostSounds(view: StackToeView) {
  const placed = view.cells.reduce((n, c) => n + (c.top ? 1 + c.under : 0), 0);
  const lastPlaced = useRef(placed);
  const last = useRef(view.status);
  useEffect(() => {
    if (placed > lastPlaced.current) play('pop');
    lastPlaced.current = placed;
  }, [placed]);
  useEffect(() => {
    if (view.status === 'reveal' && last.current === 'playing') play('fanfare');
    last.current = view.status;
  }, [view.status]);
}

function HostSide({ view, people, side }: { view: StackToeView; people: DuelPeople; side: Side }) {
  const p = people[side];
  const ended = view.status !== 'playing';
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
      <Hand view={view} side={side} px={58} />
    </div>
  );
}

export const stackToeViews: MinigameViews<StackToeView> = {
  HostView({ view, people, now }) {
    useHostSounds(view);
    const playing = view.status === 'playing';
    return (
      <div className="st-host">
        <div className="hm-center">
          {playing && <Countdown key={view.turnEndsAt} endsAt={view.turnEndsAt} now={now} total={TURN_MS} size={80} />}
          <h2 className="trivia-call">{playing ? turnLine(view, people) : resultLine(view, people)}</h2>
        </div>
        <div className="st-arena">
          <HostSide view={view} people={people} side="a" />
          <BoardGrid view={view} px={420} />
          <HostSide view={view} people={people} side="b" />
        </div>
      </div>
    );
  },

  DuelistView({ view, side, people, send, now }) {
    const other = otherSide(side);
    const mine = view.status === 'playing' && view.turn === side;
    const [pick, setPick] = useState<Size | null>(null);
    // Default to the biggest tile still in hand, and drop a size once it runs out.
    const held = SIZES.filter((s) => view.left[side][s] > 0);
    const size = pick && held.includes(pick) ? pick : (held[held.length - 1] ?? null);

    if (view.status !== 'playing') {
      return (
        <div className="phone-center st-phone">
          <div className="phone-big">{resultLine(view, people, side)}</div>
          <BoardGrid view={view} px={270} />
        </div>
      );
    }
    return (
      <div className="phone-center st-phone">
        <div className="phone-row">
          <span className={`st-badge st-${side}`}>You’re {TILE_COLOR[side]}</span>
          <Countdown key={view.turnEndsAt} endsAt={view.turnEndsAt} now={now} total={TURN_MS} size={52} />
        </div>
        <div className="phone-big st-turn">{mine ? 'Your turn!' : `${people[other].name}’s turn…`}</div>
        <BoardGrid view={view} px={252} pick={mine ? size : null} onCell={mine && size ? (cell) => send({ action: 'place', size, cell }) : undefined} />
        <Hand view={view} side={side} px={44} pick={mine ? size : null} onPick={mine ? setPick : undefined} />
        <p className="muted st-hint">{mine ? 'Pick a tile, then tap a green square.' : 'Plan your next move!'}</p>
        <div className="st-them">
          <small>{people[other].name} has</small>
          <Hand view={view} side={other} px={30} />
        </div>
      </div>
    );
  },

  RefereeView({ view, people, now }) {
    const playing = view.status === 'playing';
    return (
      <div className="phone-center st-phone">
        <div className="phone-row">
          <div className="phone-big">{playing ? turnLine(view, people) : resultLine(view, people)}</div>
          {playing && <Countdown key={view.turnEndsAt} endsAt={view.turnEndsAt} now={now} total={TURN_MS} size={52} />}
        </div>
        <BoardGrid view={view} px={270} />
        {(['a', 'b'] as Side[]).map((s) => (
          <div key={s} className="st-them">
            <small>
              {people[s].name} ({TILE_COLOR[s]})
            </small>
            <Hand view={view} side={s} px={30} />
          </div>
        ))}
        {playing && <p className="muted">The game scores itself. Just watch!</p>}
      </div>
    );
  },
};
