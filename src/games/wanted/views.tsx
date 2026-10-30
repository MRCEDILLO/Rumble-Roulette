import { memo, useEffect, useRef } from 'react';
import { Character } from '../../characters/Character';
import { ACCESSORIES, colorById } from '../../characters/looks';
import { play } from '../../sound';
import { Countdown } from '../../ui/common';
import { useTicker } from '../../ui/hooks';
import type { DuelPeople, MinigameViews } from '../types';
import { COLS, LOCKOUT_MS, SCENE_NAME, TIME_MS, WINS_NEEDED, otherSide, type Look, type Person, type Scene, type WantedView } from './logic';

type Side = 'a' | 'b';

export const lookName = (look: Look) => {
  const hat = ACCESSORIES.find((a) => a.id === look.accessory);
  return `${colorById(look.color).name} · ${!hat || hat.id === 'none' ? 'No hat' : hat.name}`;
};

/** The scenery behind the crowd: a strip of sky and landmarks along the top, and the ground they stand on. */
function Backdrop({ scene }: { scene: Scene }) {
  const art: Record<Scene, React.ReactNode> = {
    city: (
      <>
        <rect width="100" height="88" fill="#cfd0d4" />
        {Array.from({ length: 12 }, (_, i) => (
          <path key={`h${i}`} d={`M0 ${14 + i * 7} H100`} stroke="#b4b6bd" strokeWidth="0.5" />
        ))}
        {Array.from({ length: 14 }, (_, i) => (
          <path key={`v${i}`} d={`M${i * 7.5 + 2} 14 V88`} stroke="#b4b6bd" strokeWidth="0.5" />
        ))}
        <rect width="100" height="13" fill="#9fd3ff" />
        {[
          [0, 5, 9],
          [9, 2, 7],
          [16, 7, 10],
          [26, 1, 8],
          [34, 4, 12],
          [46, 6, 7],
          [53, 0, 9],
          [62, 5, 11],
          [73, 3, 8],
          [81, 6, 10],
          [91, 2, 9],
        ].map(([x, y, w], i) => (
          <g key={i}>
            <rect x={x} y={y} width={w} height={13 - y} fill={i % 2 ? '#5b6378' : '#6f7891'} />
            {Array.from({ length: Math.floor((11 - y) / 2.5) }, (_, r) => (
              <path key={r} d={`M${x + 1.5} ${y + 2 + r * 2.5} h${w - 3}`} stroke="#ffe27a" strokeWidth="0.9" strokeDasharray="1.2 1.2" />
            ))}
          </g>
        ))}
        <rect y="12" width="100" height="2.5" fill="#8d9099" />
      </>
    ),
    beach: (
      <>
        <rect width="100" height="88" fill="#f5dc9a" />
        {Array.from({ length: 70 }, (_, i) => (
          <circle key={i} cx={(i * 37.3) % 100} cy={16 + ((i * 53.7) % 72)} r="0.45" fill="#d9b867" />
        ))}
        <rect width="100" height="7" fill="#aee2ff" />
        <circle cx="86" cy="3.5" r="3" fill="#ffd23f" />
        <rect y="6" width="100" height="7" fill="#2f9bd6" />
        <path d="M0 9 q2.5 -1.5 5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0" fill="none" stroke="#bfe9ff" strokeWidth="0.7" />
        <path d="M0 13 q2.5 2 5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0 V15 H0 Z" fill="#fff6dc" />
        <g>
          <path d="M10 13 q1 -6 -1 -10" stroke="#8a5a3b" strokeWidth="1.2" fill="none" />
          <path d="M9 3 q-5 0 -6 3 M9 3 q5 -1 6 2 M9 3 q-3 -3 -6 -2 M9 3 q3 -3 6 -1" stroke="#1f9d55" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </g>
      </>
    ),
    park: (
      <>
        <rect width="100" height="88" fill="#9ed36e" />
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x={i * 12.5} y="12" width="6.25" height="76" fill="#93ca62" />
        ))}
        <rect width="100" height="12" fill="#b9e6ff" />
        {Array.from({ length: 11 }, (_, i) => (
          <g key={i}>
            <rect x={i * 9.5 + 3.4} y="8" width="1.4" height="5" fill="#7a4e2d" />
            <circle cx={i * 9.5 + 4.1} cy={6 + (i % 3)} r={3.6 + (i % 2)} fill={i % 2 ? '#2e9c4f' : '#3fb25f'} />
          </g>
        ))}
        <rect y="12" width="100" height="2" fill="#7fbf4f" />
      </>
    ),
    snow: (
      <>
        <rect width="100" height="88" fill="#eef5fb" />
        {Array.from({ length: 50 }, (_, i) => (
          <path key={i} d={`M${(i * 41.7) % 100} ${16 + ((i * 29.3) % 72)} h1.4 M${((i * 41.7) % 100) + 0.7} ${15.3 + ((i * 29.3) % 72)} v1.4`} stroke="#c6d9ea" strokeWidth="0.4" />
        ))}
        <rect width="100" height="13" fill="#9cc7f0" />
        <path d="M-5 13 L14 2 L28 13 L42 0 L60 13 L74 3 L92 13 L105 6 V13 Z" fill="#7d93b2" />
        <path d="M10.4 4 L14 2 L17.6 4 L15.5 5 L14 4 L12 5 Z M38 2.3 L42 0 L46 2.3 L44 3.5 L42 2.5 L40 3.5 Z M70.4 5 L74 3 L77.6 5 L75.5 6 L74 5 L72 6 Z" fill="#ffffff" />
        <rect y="12" width="100" height="2" fill="#dbe9f6" />
      </>
    ),
  };
  return (
    <svg className="wd-backdrop" viewBox="0 0 100 88" preserveAspectRatio="none" aria-hidden="true">
      {art[scene]}
    </svg>
  );
}

const PERSON_W = 95 / COLS;

const CrowdPeople = memo(function CrowdPeople({
  crowd,
  target,
  misses,
  onTap,
}: {
  crowd: Person[];
  target: number | null;
  misses: number[];
  onTap?: (person: number) => void;
}) {
  return (
    <div className={`wd-crowd${target !== null ? ' wd-revealed' : ''}`}>
      {crowd.map((p, i) => {
        const cls = ['wd-person', i === target && 'wd-target', misses.includes(i) && 'wd-miss'].filter(Boolean).join(' ');
        const style = { left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: `${PERSON_W}%` };
        const body = <Character color={p.color} accessory={p.accessory} pose={i === target ? 'win' : 'still'} flip={p.flip} size={100} />;
        return onTap ? (
          <button key={i} className={cls} style={style} onClick={() => onTap(i)} aria-label={`Person ${i + 1}`}>
            {body}
          </button>
        ) : (
          <div key={i} className={cls} style={style}>
            {body}
          </div>
        );
      })}
    </div>
  );
});

function Crowd({ view, misses = [], onTap, frozen }: { view: WantedView; misses?: number[]; onTap?: (person: number) => void; frozen?: React.ReactNode }) {
  return (
    <div className={`wd-scene wd-${view.scene}${frozen ? ' wd-frozen' : ''}`}>
      <Backdrop scene={view.scene} />
      <span className="wd-place">{SCENE_NAME[view.scene]}</span>
      <CrowdPeople crowd={view.crowd} target={view.target} misses={misses} onTap={onTap} />
      {frozen && <div className="wd-freeze">{frozen}</div>}
    </div>
  );
}

function Poster({ wanted, compact }: { wanted: Look; compact?: boolean }) {
  return (
    <div className={`wd-poster${compact ? ' compact' : ''}`}>
      <div className="wd-poster-title">WANTED</div>
      <div className="wd-poster-photo">
        <Character color={wanted.color} accessory={wanted.accessory} pose="still" size={compact ? 46 : 130} />
      </div>
      <div className="wd-poster-look">{lookName(wanted)}</div>
      {!compact && <div className="wd-poster-reward">Reward: 2 coins</div>}
    </div>
  );
}

/** Word joiners keep "2–1" from breaking across lines. */
const score = (view: WantedView) => `${Math.max(view.wins.a, view.wins.b)}\u2060–\u2060${Math.min(view.wins.a, view.wins.b)}`;

function resultLine(view: WantedView, people: DuelPeople, side?: Side) {
  const w = view.roundWinner;
  if (!w) return 'Time’s up! Nobody found them. Same round again!';
  if (view.winner) {
    if (side) return w === side ? `You win ${score(view)}! 🎉` : `${people[w].name} wins ${score(view)} 😵`;
    return `${people[w].name} wins ${score(view)}! 🤠`;
  }
  if (side) return w === side ? `You got round ${view.round}! 🎯` : `${people[w].name} got round ${view.round} 😬`;
  return `${people[w].name} got round ${view.round}!`;
}

/** "Round 2 · first to 2" with a star per round won. */
function RoundLine({ view, people }: { view: WantedView; people: DuelPeople }) {
  return (
    <div className="wd-round">
      <b>Round {view.round}</b>
      <span className="muted">first to {WINS_NEEDED}</span>
      <span className="wd-round-score">
        {(['a', 'b'] as Side[]).map((s) => (
          <span key={s} className="st-badge wd-badge">
            {people[s].name} <Stars won={view.wins[s]} />
          </span>
        ))}
      </span>
    </div>
  );
}

function Stars({ won }: { won: number }) {
  return (
    <span className="wd-stars" aria-label={`${won} of ${WINS_NEEDED}`}>
      {Array.from({ length: WINS_NEEDED }, (_, i) => (
        <span key={i} className={i < won ? 'on' : undefined}>
          ★
        </span>
      ))}
    </span>
  );
}

/** Re-renders while a phone is frozen, and says how long is left. */
function useFrozen(view: WantedView, side: Side, now: () => number) {
  const until = view.status === 'playing' ? view.lockedUntil[side] : 0;
  useTicker(100, until > now());
  const left = until - now();
  return left > 0 ? Math.ceil(left / 1000) : 0;
}

function HostSide({ view, people, side, now }: { view: WantedView; people: DuelPeople; side: Side; now: () => number }) {
  const p = people[side];
  const frozen = useFrozen(view, side, now);
  const got = view.status !== 'playing' && view.roundWinner === side;
  const won = view.winner === side;
  const lost = view.winner === otherSide(side);
  return (
    <div className={`wd-hunter${got ? ' won' : ''}${frozen ? ' frozen' : ''}`}>
      <Character color={p.color} accessory={p.accessory} size={54} pose={won || got ? 'win' : lost ? 'lose' : 'idle'} />
      <div>
        <div className="wd-hunter-name">
          {p.name} <Stars won={view.wins[side]} />
        </div>
        <div className="muted">
          {frozen ? `Wrong one! Frozen ${frozen}s` : got ? 'Got them!' : `${view.misses[side].length} wrong`}
        </div>
      </div>
    </div>
  );
}

function useHostSounds(view: WantedView) {
  const wrongs = view.misses.a.length + view.misses.b.length;
  const lastWrongs = useRef(wrongs);
  const last = useRef(view.status);
  useEffect(() => {
    if (wrongs > lastWrongs.current) play('buzz');
    lastWrongs.current = wrongs;
  }, [wrongs]);
  useEffect(() => {
    if (view.status === 'found' && last.current === 'playing') play(!view.roundWinner ? 'lose' : view.winner ? 'fanfare' : 'coin');
    last.current = view.status;
  }, [view.status, view.roundWinner, view.winner]);
}

export const wantedViews: MinigameViews<WantedView> = {
  HostView({ view, people, now }) {
    useHostSounds(view);
    return (
      <div className="wd-host">
        <div className="wd-host-side">
          <Poster wanted={view.wanted} />
          <div className="wd-round">
            <b>Round {view.round}</b>
            <span className="muted">first to {WINS_NEEDED}</span>
          </div>
          {view.status === 'playing' ? (
            <Countdown key={view.endsAt} endsAt={view.endsAt} now={now} total={TIME_MS} size={72} />
          ) : (
            <h2 className="trivia-call wd-call">{resultLine(view, people)}</h2>
          )}
          <HostSide view={view} people={people} side="a" now={now} />
          <HostSide view={view} people={people} side="b" now={now} />
        </div>
        <Crowd view={view} />
      </div>
    );
  },

  DuelistView({ view, side, people, send, now }) {
    const frozen = useFrozen(view, side, now);
    const playing = view.status === 'playing';
    return (
      <div className="phone-center wd-phone">
        <div className="phone-row">
          <Poster wanted={view.wanted} compact />
          {playing && <Countdown key={view.endsAt} endsAt={view.endsAt} now={now} total={TIME_MS} size={52} />}
        </div>
        <RoundLine view={view} people={people} />
        {!playing && <div className="phone-big">{resultLine(view, people, side)}</div>}
        <Crowd
          view={view}
          misses={view.misses[side]}
          onTap={playing && !frozen ? (person) => send({ action: 'tap', person }) : undefined}
          frozen={playing && frozen ? <>❌ Wrong one!<br />Frozen {frozen}…</> : undefined}
        />
        {playing && <p className="muted">Find the one on the poster and tap them! Wrong taps freeze you for {LOCKOUT_MS / 1000} s.</p>}
      </div>
    );
  },

  RefereeView({ view, people, now }) {
    const playing = view.status === 'playing';
    return (
      <div className="phone-center wd-phone">
        <div className="phone-row">
          <Poster wanted={view.wanted} compact />
          {playing && <Countdown key={view.endsAt} endsAt={view.endsAt} now={now} total={TIME_MS} size={52} />}
        </div>
        <RoundLine view={view} people={people} />
        {!playing && <div className="phone-big">{resultLine(view, people)}</div>}
        <Crowd view={view} />
        <div className="mf-scores">
          {(['a', 'b'] as Side[]).map((s) => (
            <span key={s} className="st-badge wd-badge">
              {people[s].name}: {view.misses[s].length} wrong
            </span>
          ))}
        </div>
        {playing && <p className="muted">The game scores itself. Don’t let anyone point them out!</p>}
      </div>
    );
  },
};
