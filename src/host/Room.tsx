import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Character } from '../characters/Character';
import {
  BET_MS,
  MIN_FREE_PLAYERS,
  MIN_PARTY_PLAYERS,
  PICK_MS,
  hostContinue,
  hostEndRounds,
  hostFreeStart,
  project,
  refAction,
  removeSeat,
  resetForNewGame,
  startGame,
} from '../engine/engine';
import type { EngineState, Profile, PublicState, RefAction, SeatId } from '../engine/types';
import { ALL_GAME_IDS, gameInfo } from '../games/logic';
import { GAME_VIEWS } from '../games/views';
import type { DuelPeople } from '../games/types';
import type { HostBackend } from '../net/types';
import { getSoundSettings, play, setMuted, setVolume, startMusic, stopMusic } from '../sound';
import { Countdown, PlayerTag, RefControls, duelTitle, peopleOf, signed } from '../ui/common';
import { useOnChange, useTicker } from '../ui/hooks';
import { Logo } from '../ui/Logo';
import { Wheel } from '../ui/Wheel';
import { useHostGame } from './useHostGame';

const rng = Math.random;
const now = () => Date.now();

export function joinUrl(code: string) {
  return `${location.origin}${location.pathname}${location.search}#/play/${code}`;
}

interface Props {
  backend: HostBackend;
  initial: EngineState;
  profiles: Profile[];
  onClose: () => void;
}

export function Room({ backend, initial, profiles: initialProfiles, onClose }: Props) {
  const { state, profiles, update } = useHostGame(backend, initial, initialProfiles);
  const [menu, setMenu] = useState(false);
  const pub = project(state, profiles, Date.now());
  const d = state.duel;

  // Sound cues on phase changes.
  useOnChange(`${state.phase}:${state.phaseStartedAt}`, () => {
    switch (state.phase) {
      case 'pick':
        play('drum');
        break;
      case 'spin':
        play('whoosh');
        break;
      case 'bet':
        play('reveal');
        break;
      case 'duel':
        play('pop');
        break;
      case 'result':
        if (d?.winner && d.winner !== 'draw') {
          play('reveal');
          setTimeout(() => play('coin'), 500);
        } else play('lose');
        break;
      case 'end':
        play('fanfare');
        break;
    }
  });

  const people = peopleOf(pub);
  const sidebar = !['lobby', 'end', 'freeMenu'].includes(state.phase) && state.mode === 'party';

  return (
    <div className="screen host">
      <header className="topbar">
        <Logo />
        <div className="topbar-mid">{d && state.phase !== 'end' ? duelTitle(pub) : state.mode === 'free' ? 'FREE PLAY' : ''}</div>
        <div className="topbar-right">
          <span className="room-code-small">
            Join: <b>{state.code}</b>
          </span>
          <SoundButton />
          <button className="btn btn-small" onClick={() => setMenu(true)}>
            ☰ Menu
          </button>
        </div>
      </header>

      <div className={`host-body${sidebar ? ' with-sidebar' : ''}`}>
        <main className="stage">
          <Stage pub={pub} state={state} people={people} update={update} onClose={onClose} />
        </main>
        {sidebar && <Leaderboard pub={pub} />}
      </div>

      {menu && (
        <HostMenu
          pub={pub}
          state={state}
          onCloseMenu={() => setMenu(false)}
          update={update}
          onCloseRoom={() => {
            if (confirm('End this game and close the room?')) onClose();
          }}
        />
      )}
    </div>
  );
}

type Update = (fn: (s: EngineState) => EngineState) => void;

function Stage({
  pub,
  state,
  people,
  update,
  onClose,
}: {
  pub: PublicState;
  state: EngineState;
  people: DuelPeople | null;
  update: Update;
  onClose: () => void;
}) {
  const d = pub.duel;
  switch (pub.phase) {
    case 'lobby':
      return <Lobby pub={pub} onStart={() => update((s) => startGame(s, now(), rng))} />;
    case 'paused':
      return (
        <div className="center-col">
          <h1>Waiting for players</h1>
          <p className="lead">
            Party mode needs at least {MIN_PARTY_PLAYERS} players. Scan the code to join: <b>{pub.code}</b>
          </p>
          <QrBlock code={pub.code} />
          <button
            className="btn btn-primary btn-huge"
            disabled={pub.order.length < MIN_PARTY_PLAYERS}
            onClick={() => update((s) => hostContinue(s, now(), rng))}
          >
            Continue
          </button>
        </div>
      );
    case 'freeMenu':
      return <FreeMenu pub={pub} update={update} />;
    case 'pick':
      return <PickReveal pub={pub} />;
    case 'spin':
      return (
        <div className="center-col">
          <h1 className="phase-title">{d?.kind === 'round' ? 'Spin the wheel!' : duelTitle(pub)}</h1>
          <Wheel spin={pub.spin!} now={now} onTick={() => play('tick')} />
          <SpinLanding pub={pub} />
        </div>
      );
    case 'bet':
      return <BetScreen pub={pub} />;
    case 'duel': {
      const Views = GAME_VIEWS[d!.gameId!];
      const info = gameInfo(d!.gameId!)!;
      return (
        <div className="duel-stage">
          <div className="duel-banner" style={{ background: info.color }}>
            <span>
              {info.icon} {info.name}
            </span>
            {people?.ref && <span className="muted-dark">Referee: {people.ref.name}</span>}
          </div>
          {d!.view && <Views.HostView view={d!.view} people={people!} now={now} />}
        </div>
      );
    }
    case 'result':
      return (
        <ResultScreen
          pub={pub}
          state={state}
          onAction={(a) => update((s) => refAction(s, a, now(), rng))}
        />
      );
    case 'end':
      return (
        <EndScreen
          pub={pub}
          onAgain={() => update((s) => resetForNewGame(s, s.mode, s.totalRounds, s.enabledGames, now()))}
          onNewSetup={onClose}
        />
      );
  }
}

function QrBlock({ code, size = 260 }: { code: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(joinUrl(code), { margin: 1, width: size * 2, color: { dark: '#1b1035', light: '#ffffff' } })
      .then(setSrc)
      .catch(() => setSrc(null));
  }, [code, size]);
  return <div className="qr">{src ? <img src={src} width={size} height={size} alt={`QR code to join room ${code}`} /> : null}</div>;
}

function Lobby({ pub, onStart }: { pub: PublicState; onStart: () => void }) {
  const min = pub.mode === 'party' ? MIN_PARTY_PLAYERS : MIN_FREE_PLAYERS;
  const n = pub.order.length;
  return (
    <div className="lobby">
      <div className="lobby-join card">
        <h2>Join on your phone</h2>
        <QrBlock code={pub.code} />
        <div className="room-code">{pub.code}</div>
        <div className="join-url">{joinUrl(pub.code).replace(/^https?:\/\//, '')}</div>
      </div>
      <div className="lobby-players">
        <h1>
          {n} player{n === 1 ? '' : 's'} in
          <small> ({pub.mode === 'party' ? `${pub.totalRounds} rounds` : 'free play'})</small>
        </h1>
        <div className="lobby-grid">
          {pub.order.map((id) => {
            const s = pub.seats[id];
            return <PlayerTag key={id} look={s} size={90} dim={!s.connected} sub={s.connected ? undefined : 'reconnecting…'} />;
          })}
          {Array.from({ length: Math.max(0, min - n) }, (_, i) => (
            <div key={`empty${i}`} className="player-tag empty">
              <div className="empty-slot">?</div>
            </div>
          ))}
        </div>
        <button className="btn btn-primary btn-huge" disabled={n < min} onClick={onStart}>
          {n < min ? `Need ${min - n} more` : 'Start game ▶'}
        </button>
      </div>
    </div>
  );
}

function PickReveal({ pub }: { pub: PublicState }) {
  useTicker(80);
  const d = pub.duel!;
  const elapsed = now() - pub.phaseStartedAt;
  const rolling = elapsed < PICK_MS - 2000;
  const roll = (offset: number) => {
    const ids = pub.order;
    return ids[(Math.floor(elapsed / 90) + offset) % ids.length];
  };
  const slot = (id: SeatId | null, offset: number, label: string, flip = false) => {
    const show = rolling ? roll(offset) : id;
    const s = show ? pub.seats[show] : null;
    return (
      <div className={`pick-slot${rolling ? ' rolling' : ' landed'}`}>
        <div className="pick-label">{label}</div>
        {s ? <PlayerTag look={s} size={rolling ? 120 : 160} flip={flip} pose={rolling ? 'still' : 'win'} /> : <div className="empty-slot">—</div>}
      </div>
    );
  };
  return (
    <div className="center-col">
      <h1 className="phase-title">
        {d.kind === 'final' ? '🏆 The Final 🏆' : d.kind === 'tiebreak' ? 'Tie-break!' : 'Who’s up?'}
      </h1>
      {d.kind === 'tiebreak' && <p className="lead">Tied for a place in the final. Winner goes through.</p>}
      <div className="pick-row">
        {slot(d.a, 0, 'Duelist')}
        <div className="vs big">VS</div>
        {slot(d.b, 2, 'Duelist', true)}
      </div>
      {d.ref && <div className="pick-ref">{slot(d.ref, 1, 'Referee')}</div>}
    </div>
  );
}

function SpinLanding({ pub }: { pub: PublicState }) {
  useTicker(200);
  const info = gameInfo(pub.spin!.gameId)!;
  const landed = now() - pub.spin!.startedAt > 4300;
  return (
    <div className={`spin-landing${landed ? ' show' : ''}`}>
      <h2>
        {info.icon} {info.name}
      </h2>
      <p>{info.rules}</p>
    </div>
  );
}

function BetScreen({ pub }: { pub: PublicState }) {
  const d = pub.duel!;
  const info = gameInfo(d.gameId!)!;
  return (
    <div className="center-col">
      <div className="bet-header">
        <div>
          <h1 className="phase-title">Place your bets!</h1>
          <p className="lead">
            {info.icon} <b>{info.name}</b>: {info.rules}
          </p>
        </div>
        {pub.phaseEndsAt && <Countdown endsAt={pub.phaseEndsAt} now={now} total={BET_MS} size={120} />}
      </div>
      <div className="pick-row">
        <PlayerTag look={pub.seats[d.a]} size={170} coins={pub.seats[d.a].coins} />
        <div className="vs big">VS</div>
        <PlayerTag look={pub.seats[d.b]} size={170} flip coins={pub.seats[d.b].coins} />
      </div>
      <p className="muted">Bet 1–3 coins on your phone. Bets stay secret until the duel is over.</p>
      <div className="bettor-row">
        {pub.bettors.map((id) => {
          const s = pub.seats[id];
          const locked = pub.betLocked.includes(id);
          return (
            <div key={id} className={`bettor${locked ? ' locked' : ''}`}>
              <Character color={s.color} accessory={s.accessory} size={56} pose={locked ? 'still' : 'idle'} />
              <span>{s.name}</span>
              <b>{locked ? 'Locked ✓' : '…'}</b>
              {pub.gifted.includes(id) && <small>+1 free coin</small>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResultScreen({
  pub,
  onAction,
}: {
  pub: PublicState;
  state: EngineState;
  onAction: (a: RefAction) => void;
}) {
  const d = pub.duel!;
  // In free play (or with no referee) the host drives the game from the big screen.
  const hostControls = (d.kind === 'free' || !d.ref) && <RefControls pub={pub} onAction={onAction} compact />;
  if (d.winner === 'draw') {
    return (
      <div className="center-col">
        <h1 className="phase-title">It’s a draw!</h1>
        <p className="lead">
          {d.ref ? `${pub.seats[d.ref]?.name ?? 'The referee'} will redo the game or skip it.` : 'Redo the game or skip it.'}
        </p>
        <div className="pick-row">
          <PlayerTag look={pub.seats[d.a]} size={140} pose="lose" />
          <div className="vs big">=</div>
          <PlayerTag look={pub.seats[d.b]} size={140} flip pose="lose" />
        </div>
        {hostControls}
      </div>
    );
  }
  const winnerId = d[d.winner!];
  const loserId = d.winner === 'a' ? d.b : d.a;
  const winner = pub.seats[winnerId];
  const loser = pub.seats[loserId];
  const bets = pub.bets ?? {};
  const delta = pub.lastDelta ?? {};
  return (
    <div className="center-col">
      <h1 className="phase-title winner-title">{winner ? `${winner.name} wins!` : 'Winner!'}</h1>
      {d.kind === 'tiebreak' && <p className="lead">{winner?.name} goes through to the final.</p>}
      <div className="pick-row">
        {winner && <PlayerTag look={winner} size={190} pose="win" sub={d.kind === 'round' ? '+2 coins' : undefined} />}
        {loser && <PlayerTag look={loser} size={120} pose="lose" flip dim />}
      </div>
      {d.kind === 'round' && Object.keys(bets).length > 0 && (
        <div className="bet-results">
          {Object.entries(bets).map(([id, bet]) => {
            const s = pub.seats[id];
            if (!s) return null;
            const gain = delta[id] ?? 0;
            return (
              <div key={id} className={`bet-result ${gain >= 0 ? 'won' : 'lost'}`}>
                <Character color={s.color} accessory={s.accessory} size={48} pose={gain >= 0 ? 'win' : 'lose'} />
                <span>
                  <b>{s.name}</b> bet {bet.amount} on {pub.seats[d[bet.on]]?.name}
                  {bet.auto && <small> (auto)</small>}
                </span>
                <b className="delta">{signed(gain)}</b>
              </div>
            );
          })}
        </div>
      )}
      {hostControls || (
        <p className="muted">Waiting for {pub.seats[d.ref!]?.name ?? 'the referee'} to continue…</p>
      )}
    </div>
  );
}

function Leaderboard({ pub }: { pub: PublicState }) {
  const sorted = [...pub.order].sort((x, y) => pub.seats[y].coins - pub.seats[x].coins);
  const d = pub.duel;
  return (
    <aside className="leaderboard">
      <h3>Coins</h3>
      <ol>
        {sorted.map((id) => {
          const s = pub.seats[id];
          const role = d && (d.a === id || d.b === id) ? '⚔️' : d?.ref === id ? '🧑‍⚖️' : '';
          const change = pub.phase === 'result' ? pub.lastDelta?.[id] : undefined;
          return (
            <li key={id} className={s.connected ? '' : 'dim'}>
              <Character color={s.color} accessory={s.accessory} size={34} pose="still" />
              <span className="lb-name">
                {s.name} {role}
                {!s.connected && <small> (away)</small>}
              </span>
              <span className="lb-coins">
                {s.coins}
                {change ? <small className={change > 0 ? 'up' : 'down'}>{signed(change)}</small> : null}
              </span>
            </li>
          );
        })}
      </ol>
      {pub.finals && (
        <p className="muted small-print">Top two go to the final. Ties play a tie-break first.</p>
      )}
    </aside>
  );
}

function FreeMenu({ pub, update }: { pub: PublicState; update: Update }) {
  const [gameId, setGameId] = useState<string | null>(null);
  const [a, setA] = useState<string>('');
  const [b, setB] = useState<string>('');
  const [ref, setRef] = useState<string>('');
  const info = gameId ? gameInfo(gameId) : null;
  const needsRef = info?.needsReferee ?? false;
  const tooFew = needsRef && pub.order.length < 3;
  const pickPlayer = (value: string, set: (v: string) => void, label: string, exclude: string[]) => (
    <label className="free-select">
      {label}
      <select value={value} onChange={(e) => set(e.target.value)}>
        <option value="">🎲 Random</option>
        {pub.order
          .filter((id) => !exclude.includes(id))
          .map((id) => (
            <option key={id} value={id}>
              {pub.seats[id].name}
            </option>
          ))}
      </select>
    </label>
  );
  return (
    <div className="free-menu">
      <h1 className="phase-title">Free play</h1>
      <div className="game-cards">
        <button className={`game-card${gameId === null ? ' on' : ''}`} onClick={() => setGameId(null)}>
          <span className="game-icon big">🎡</span>
          <b>Spin the wheel</b>
          <small>Random game</small>
        </button>
        {ALL_GAME_IDS.map((id) => {
          const g = gameInfo(id)!;
          return (
            <button key={id} className={`game-card${gameId === id ? ' on' : ''}`} onClick={() => setGameId(id)}>
              <span className="game-icon big" style={{ background: g.color }}>
                {g.icon}
              </span>
              <b>{g.name}</b>
              <small>{g.rules}</small>
            </button>
          );
        })}
      </div>
      <div className="free-players">
        {pickPlayer(a, setA, 'Player 1', [b, ref].filter(Boolean))}
        {pickPlayer(b, setB, 'Player 2', [a, ref].filter(Boolean))}
        {(needsRef || gameId === null) && pickPlayer(ref, setRef, needsRef ? 'Referee' : 'Referee (if needed)', [a, b].filter(Boolean))}
      </div>
      {tooFew && <p className="error">This game needs a referee, so it needs 3 players.</p>}
      <button
        className="btn btn-primary btn-huge"
        disabled={tooFew}
        onClick={() =>
          update((s) =>
            hostFreeStart(s, { gameId, a: a || null, b: b || null, ref: ref || null, spin: gameId === null }, now(), rng),
          )
        }
      >
        Play ▶
      </button>
      <div className="lobby-grid small">
        {pub.order.map((id) => (
          <PlayerTag key={id} look={pub.seats[id]} size={56} dim={!pub.seats[id].connected} />
        ))}
      </div>
    </div>
  );
}

function EndScreen({ pub, onAgain, onNewSetup }: { pub: PublicState; onAgain: () => void; onNewSetup: () => void }) {
  useTicker(250);
  const AWARD_MS = 3500;
  const step = Math.floor((now() - pub.phaseStartedAt) / AWARD_MS);
  const [skip, setSkip] = useState(false);
  const showingAward = !skip && step < pub.awards.length;
  if (showingAward) {
    const award = pub.awards[step];
    return (
      <div className="center-col award-card" key={award.id} onClick={() => setSkip(true)}>
        <div className="muted">
          Award {step + 1} of {pub.awards.length}
        </div>
        <h1 className="phase-title">{award.title}</h1>
        <p className="lead">{award.blurb}</p>
        <div className="pick-row">
          {award.seats.map((id) =>
            pub.seats[id] ? <PlayerTag key={id} look={pub.seats[id]} size={award.seats.length > 2 ? 110 : 160} pose="win" /> : null,
          )}
        </div>
        <div className="award-value">{award.value}</div>
        <small className="muted">Tap to skip</small>
      </div>
    );
  }
  const champ = pub.champion ? pub.seats[pub.champion] : null;
  const rest = [...pub.order]
    .filter((id) => id !== pub.champion && id !== pub.runnerUp)
    .sort((x, y) => pub.seats[y].coins - pub.seats[x].coins);
  const ranking = [pub.champion, pub.runnerUp, ...rest].filter((id): id is string => !!id && !!pub.seats[id]);
  return (
    <div className="end-screen">
      <div className="champion">
        <div className="confetti" aria-hidden>
          {Array.from({ length: 30 }, (_, i) => (
            <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 10) * 0.3}s` }} />
          ))}
        </div>
        <h1 className="phase-title">👑 Champion 👑</h1>
        {champ && <Character color={champ.color} accessory="crown" size={220} pose="win" />}
        <h1 className="winner-title">{champ?.name}</h1>
      </div>
      <div className="card scoreboard">
        <h2>Scoreboard</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Coins</th>
              <th>Duels</th>
              <th>Bets</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((id, i) => {
              const s = pub.seats[id];
              const g = s.gs!;
              return (
                <tr key={id}>
                  <td>{i + 1}</td>
                  <td className="sb-name">
                    <Character color={s.color} accessory={s.accessory} size={30} pose="still" /> {s.name}
                  </td>
                  <td>{s.coins}</td>
                  <td>
                    {g.duelWins}–{g.duelLosses}
                  </td>
                  <td>
                    {g.betsWon}–{g.betsLost} ({signed(g.betNet)})
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {pub.awards.length > 0 && (
          <ul className="award-list">
            {pub.awards.map((a) => (
              <li key={a.id}>
                <b>{a.title}:</b> {a.seats.map((id) => pub.seats[id]?.name).join(', ')} ({a.value})
              </li>
            ))}
          </ul>
        )}
        <div className="row-buttons">
          <button className="btn btn-primary" onClick={onAgain}>
            Play again (same players)
          </button>
          <button className="btn" onClick={onNewSetup}>
            New game setup
          </button>
        </div>
      </div>
    </div>
  );
}

function SoundButton() {
  const [muted, setM] = useState(getSoundSettings().muted);
  return (
    <button
      className="btn btn-small"
      aria-label={muted ? 'Unmute' : 'Mute'}
      onClick={() => {
        setMuted(!muted);
        setM(!muted);
        if (muted) startMusic();
        else stopMusic();
      }}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}

function HostMenu({
  pub,
  state,
  update,
  onCloseMenu,
  onCloseRoom,
}: {
  pub: PublicState;
  state: EngineState;
  update: Update;
  onCloseMenu: () => void;
  onCloseRoom: () => void;
}) {
  const [volume, setV] = useState(getSoundSettings().volume);
  const canEndRounds = state.mode === 'party' && !state.finals && !['lobby', 'end', 'paused'].includes(state.phase);
  return (
    <div className="modal-backdrop" onClick={onCloseMenu}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Host menu</h2>
          <button className="btn btn-small" onClick={onCloseMenu}>
            ✕
          </button>
        </div>

        {pub.duel && (
          <section>
            <h3>Referee controls</h3>
            <p className="muted">Use these if the referee’s phone isn’t working.</p>
            <RefControls
              pub={pub}
              onAction={(a) => {
                update((s) => refAction(s, a, now(), rng));
                onCloseMenu();
              }}
            />
          </section>
        )}

        {canEndRounds && (
          <section>
            <h3>Game</h3>
            <button
              className="btn"
              onClick={() => {
                if (!confirm('Skip the remaining rounds and go straight to the final?')) return;
                update((s) => hostEndRounds(s, now(), rng));
                onCloseMenu();
              }}
            >
              Skip to the final
            </button>
          </section>
        )}

        <section>
          <h3>Players</h3>
          <ul className="menu-players">
            {pub.order.map((id) => {
              const s = pub.seats[id];
              return (
                <li key={id}>
                  <Character color={s.color} accessory={s.accessory} size={32} pose="still" />
                  <span>
                    {s.name} {!s.connected && <small className="muted">(away)</small>}
                  </span>
                  <button
                    className="btn btn-quiet btn-small"
                    onClick={() => confirm(`Remove ${s.name} from the game?`) && update((st) => removeSeat(st, id, now(), rng))}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h3>Sound</h3>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => {
              setV(Number(e.target.value));
              setVolume(Number(e.target.value));
            }}
          />
        </section>

        <section>
          <button className="btn btn-danger" onClick={onCloseRoom}>
            End game and close room
          </button>
        </section>
      </div>
    </div>
  );
}
