import { useEffect, useState } from 'react';
import { Character } from '../characters/Character';
import { ACCESSORIES, COLORS } from '../characters/looks';
import { BET_MS, MAX_BET } from '../engine/engine';
import type { Profile, PublicState, RefAction, Side } from '../engine/types';
import { gameInfo } from '../games/logic';
import { GAME_VIEWS } from '../games/views';
import { phoneBackend } from '../net/backend';
import { cleanRoomCode } from '../net/roomCode';
import type { PhoneMessage } from '../net/types';
import { applyTheme } from '../themes/themes';
import { GameIcon } from '../games/GameIcon';
import { Countdown, RefControls, duelTitle, peopleOf, signed } from '../ui/common';
import { useHostClock, useOnChange, useWakeLock, vibrate } from '../ui/hooks';
import { LoadingMark, Logo } from '../ui/Logo';

export function PlayerApp({ code }: { code: string | null }) {
  if (!code) return <EnterCode />;
  return <Connected code={code} />;
}

function EnterCode() {
  const [value, setValue] = useState('');
  const go = () => {
    const c = cleanRoomCode(value);
    if (c.length === 4) location.hash = `#/play/${c}`;
  };
  return (
    <div className="screen phone center">
      <a className="btn btn-quiet btn-small back-link" href="#/">
        ← Back
      </a>
      <Logo size="big" />
      <h2>Enter the room code</h2>
      <input
        className="code-input"
        value={value}
        onChange={(e) => setValue(cleanRoomCode(e.target.value))}
        onKeyDown={(e) => e.key === 'Enter' && go()}
        placeholder="ABCD"
        autoFocus
        inputMode="text"
        autoCapitalize="characters"
      />
      <button className="btn btn-primary btn-huge" disabled={value.length !== 4} onClick={go}>
        Join
      </button>
    </div>
  );
}

function Connected({ code }: { code: string }) {
  const backend = phoneBackend();
  const [uid, setUid] = useState<string | null>(null);
  const [pub, setPub] = useState<PublicState | null>(null);
  const [status, setStatus] = useState<'connecting' | 'missing' | 'ok'>('connecting');

  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      const id = await backend.ready();
      if (cancelled) return;
      setUid(id);
      const exists = await backend.roomExists(code);
      if (cancelled) return;
      if (!exists) {
        setStatus('missing');
        return;
      }
      setStatus('ok');
      stop = backend.watch(code, setPub);
    })().catch(() => setStatus('missing'));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [backend, code]);

  // Match the TV's look.
  useEffect(() => {
    if (pub?.theme) applyTheme(pub.theme);
  }, [pub?.theme]);

  const send = (msg: PhoneMessage) => backend.send(code, msg);
  const seated = !!(uid && pub?.seats[uid]);
  useWakeLock(seated);

  if (status === 'missing') {
    return (
      <div className="screen phone center">
        <Logo />
        <h2>Room {code} not found</h2>
        <p>Check the code on the big screen.</p>
        <a className="btn" href="#/play">
          Try another code
        </a>
      </div>
    );
  }
  if (!pub || !uid)
    return (
      <div className="screen phone center">
        <LoadingMark label={`Connecting to ${code}`} />
        <p>Connecting to {code}…</p>
      </div>
    );
  if (!seated) return <ProfilePicker pub={pub} uid={uid} send={send} />;
  return <Seated pub={pub} uid={uid} send={send} />;
}

// ---------------------------------------------------------------- joining

function ProfilePicker({ pub, uid, send }: { pub: PublicState; uid: string; send: (m: PhoneMessage) => void }) {
  const [creating, setCreating] = useState(pub.profiles.length === 0);
  const [waiting, setWaiting] = useState(false);
  const reject = pub.rejects[uid];
  useOnChange(reject?.at, () => setWaiting(false));

  if (creating) {
    return <CreateProfile pub={pub} reject={reject?.msg} waiting={waiting} onBack={pub.profiles.length ? () => setCreating(false) : undefined} onCreate={(look) => {
      setWaiting(true);
      send({ t: 'create', look });
    }} />;
  }

  const sorted = [...pub.profiles].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="screen phone">
      <header className="phone-header">
        <Logo />
        <span className="muted">Room {pub.code}</span>
      </header>
      <h2>Who are you?</h2>
      {reject && <p className="error">{reject.msg}</p>}
      <div className="profile-picker">
        {sorted.map((p) => {
          const taken = pub.takenProfiles.includes(p.id);
          return (
            <button
              key={p.id}
              className="profile-card"
              disabled={taken || waiting}
              onClick={() => {
                setWaiting(true);
                send({ t: 'join', profileId: p.id });
              }}
            >
              <Character color={p.color} accessory={p.accessory} size={56} pose="still" />
              <span className="profile-card-text">
                <b>{p.name}</b>
                {taken ? <small>Already playing</small> : <ProfileStats p={p} />}
              </span>
            </button>
          );
        })}
      </div>
      <button className="btn btn-primary" onClick={() => setCreating(true)}>
        + New profile
      </button>
    </div>
  );
}

function ProfileStats({ p }: { p: Profile }) {
  const s = p.stats;
  const duels = s.duelWins + s.duelLosses;
  return (
    <small>
      Duels {s.duelWins}–{s.duelLosses}
      {duels ? ` (${Math.round((100 * s.duelWins) / duels)}%)` : ''} · bet on {s.betsOn}× · against {s.betsAgainst}×
      {s.gamesWon ? ` · ${s.gamesWon}🏆` : ''}
    </small>
  );
}

function CreateProfile({
  pub,
  reject,
  waiting,
  onBack,
  onCreate,
}: {
  pub: PublicState;
  reject?: string;
  waiting: boolean;
  onBack?: () => void;
  onCreate: (look: { name: string; color: string; accessory: string }) => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0].id);
  const [accessory, setAccessory] = useState('none');
  const valid = name.trim().length > 0;
  return (
    <div className="screen phone">
      <header className="phone-header">
        {onBack ? (
          <button className="btn btn-small" onClick={onBack}>
            ← Back
          </button>
        ) : (
          <Logo />
        )}
        <span className="muted">Room {pub.code}</span>
      </header>
      <h2>New profile</h2>
      <div className="creator-preview">
        <Character color={color} accessory={accessory} size={130} />
      </div>
      <label className="field">
        Name
        <input value={name} maxLength={14} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoFocus />
      </label>
      <LookPicker color={color} accessory={accessory} onColor={setColor} onAccessory={setAccessory} />
      {reject && <p className="error">{reject}</p>}
      <button className="btn btn-primary btn-huge" disabled={!valid || waiting} onClick={() => onCreate({ name: name.trim(), color, accessory })}>
        {waiting ? 'Joining…' : 'Join game'}
      </button>
    </div>
  );
}

/** Colour swatches and accessory buttons, shared by the new-profile and edit-look screens. */
function LookPicker({
  color,
  accessory,
  onColor,
  onAccessory,
}: {
  color: string;
  accessory: string;
  onColor: (id: string) => void;
  onAccessory: (id: string) => void;
}) {
  return (
    <>
      <div className="field">
        Colour
        <div className="swatches">
          {COLORS.map((c) => (
            <button
              key={c.id}
              className={`swatch${color === c.id ? ' on' : ''}`}
              style={{ background: c.main }}
              aria-label={c.name}
              onClick={() => onColor(c.id)}
            />
          ))}
        </div>
      </div>
      <div className="field">
        Accessory
        <div className="accessories">
          {ACCESSORIES.map((a) => (
            <button key={a.id} className={`accessory${accessory === a.id ? ' on' : ''}`} onClick={() => onAccessory(a.id)}>
              <Character color={color} accessory={a.id} size={40} pose="still" />
              <small>{a.name}</small>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- waiting in the lobby

function LobbyWait({ pub, uid, send }: { pub: PublicState; uid: string; send: (m: PhoneMessage) => void }) {
  const me = pub.seats[uid];
  const [editing, setEditing] = useState(false);
  const [color, setColor] = useState(me.color);
  const [accessory, setAccessory] = useState(me.accessory);
  const reject = pub.rejects[uid];
  const profile = pub.profiles.find((p) => p.id === me.profileId);

  if (editing) {
    return (
      <div className="edit-look">
        <h2>Change your look</h2>
        <div className="creator-preview">
          <Character color={color} accessory={accessory} size={130} />
        </div>
        <LookPicker color={color} accessory={accessory} onColor={setColor} onAccessory={setAccessory} />
        <div className="row-buttons">
          <button className="btn" onClick={() => setEditing(false)}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              send({ t: 'look', color, accessory });
              setEditing(false);
            }}
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="phone-center">
      <Character color={me.color} accessory={me.accessory} size={150} />
      <div className="phone-big">You’re in!</div>
      <p>Waiting for the host to start the game.</p>
      {reject && <p className="error">{reject.msg}</p>}
      <button
        className="btn btn-small"
        onClick={() => {
          setColor(me.color);
          setAccessory(me.accessory);
          setEditing(true);
        }}
      >
        ✏️ Change look
      </button>
      {profile && <AllTimeStats p={profile} />}
    </div>
  );
}

function AllTimeStats({ p }: { p: Profile }) {
  const s = p.stats;
  const duels = s.duelWins + s.duelLosses;
  const bets = s.betsWon + s.betsLost;
  const pct = (n: number, of: number) => (of ? `${Math.round((100 * n) / of)}%` : '–');
  const rows: [string, string][] = [
    ['Games played', String(s.gamesPlayed)],
    ['Games won 🏆', String(s.gamesWon)],
    ['Duels won', `${s.duelWins} of ${duels} (${pct(s.duelWins, duels)})`],
    ['Bets won', `${s.betsWon} of ${bets} (${pct(s.betsWon, bets)})`],
    ['Coins from bets', signed(s.betNet)],
    ['Others bet on you', `${s.betsOn}×`],
    ['Others bet against you', `${s.betsAgainst}×`],
  ];
  return (
    <div className="my-stats card">
      <h3>Your all-time stats</h3>
      <dl>
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------- in the game

function Seated({ pub, uid, send }: { pub: PublicState; uid: string; send: (m: PhoneMessage) => void }) {
  const me = pub.seats[uid];
  const d = pub.duel;
  const role: 'a' | 'b' | 'ref' | 'bettor' | null = d ? (d.a === uid ? 'a' : d.b === uid ? 'b' : d.ref === uid ? 'ref' : 'bettor') : null;
  const now = useHostClock(pub);

  // Buzz when it's your turn to do something.
  useOnChange(`${pub.phase}:${pub.phaseStartedAt}:${role}`, () => {
    if (pub.phase === 'pick' && (role === 'a' || role === 'b' || role === 'ref')) vibrate([150, 80, 150]);
    if (pub.phase === 'bet' && role === 'bettor') vibrate(120);
  });

  return (
    <div className="screen phone seated" style={{ ['--me' as string]: me.color }}>
      <header className="phone-header">
        <div className="me">
          <Character color={me.color} accessory={me.accessory} size={36} pose="still" />
          <b>{me.name}</b>
        </div>
        {pub.mode === 'party' && <div className="coins big">🪙 {me.coins}</div>}
      </header>
      <div className="phone-body">
        <PhaseView pub={pub} uid={uid} role={role} send={send} now={now} />
      </div>
      {(pub.phase === 'lobby' || pub.phase === 'freeMenu' || pub.phase === 'paused') && (
        <button
          className="btn btn-quiet btn-small leave"
          onClick={() => confirm('Leave the game?') && send({ t: 'leave' })}
        >
          Leave game
        </button>
      )}
    </div>
  );
}

interface PhaseProps {
  pub: PublicState;
  uid: string;
  role: 'a' | 'b' | 'ref' | 'bettor' | null;
  send: (m: PhoneMessage) => void;
  now: () => number;
}

function PhaseView({ pub, uid, role, send, now }: PhaseProps) {
  const d = pub.duel;
  const people = peopleOf(pub);
  const refAct = (action: RefAction) => send({ t: 'ref', action });
  const name = (id: string | null | undefined) => (id && pub.seats[id]?.name) || '?';
  const me = pub.seats[uid];

  switch (pub.phase) {
    case 'lobby':
      return <LobbyWait pub={pub} uid={uid} send={send} />;
    case 'paused':
      return <div className="phone-center phone-big">Waiting for more players…</div>;
    case 'freeMenu':
      return <div className="phone-center phone-big">Picking the next game…</div>;
    case 'end': {
      const g = me.gs;
      const won = pub.champion === uid;
      const myAwards = pub.awards.filter((a) => a.seats.includes(uid));
      return (
        <div className="phone-center">
          <Character color={me.color} accessory={won ? 'crown' : me.accessory} size={120} pose={won ? 'win' : 'idle'} />
          <div className="phone-big">{won ? 'You are the champion! 👑' : `${name(pub.champion)} is the champion!`}</div>
          {g && (
            <ul className="summary">
              <li>Coins: {me.coins}</li>
              <li>
                Duels won: {g.duelWins} of {g.duelWins + g.duelLosses}
              </li>
              <li>
                Bets won: {g.betsWon} of {g.betsWon + g.betsLost} ({signed(g.betNet)} coins)
              </li>
            </ul>
          )}
          {myAwards.map((a) => (
            <div key={a.id} className="chip">
              🏅 {a.title}
            </div>
          ))}
        </div>
      );
    }
  }

  if (!d) return null;
  const title = duelTitle(pub);

  if (pub.phase === 'pick') {
    return (
      <div className="phone-center">
        <div className="muted">{title}</div>
        {role === 'a' || role === 'b' ? (
          <div className="phone-big">You’re up! ⚔️</div>
        ) : role === 'ref' ? (
          <div className="phone-big">You’re the Host 🎤</div>
        ) : (
          <div className="phone-big">
            {name(d.a)} vs {name(d.b)}
          </div>
        )}
        {(role === 'a' || role === 'b') && <p>vs {name(role === 'a' ? d.b : d.a)}</p>}
        {role === 'ref' && <RefControls pub={pub} onAction={refAct} compact />}
      </div>
    );
  }

  if (pub.phase === 'spin') {
    return (
      <div className="phone-center">
        <div className="muted">{title}</div>
        <LoadingMark size={110} label="Spinning for a game" />
        <p>Spinning for a game…</p>
        {role === 'ref' && <RefControls pub={pub} onAction={refAct} compact />}
      </div>
    );
  }

  const info = gameInfo(d.gameId!)!;

  if (pub.phase === 'bet') {
    return (
      <div className="phone-center">
        <GameBanner info={info} role={role} />
        {role === 'bettor' || role === 'ref' ? (
          <BetPanel pub={pub} uid={uid} send={send} now={now} />
        ) : (
          <>
            <div className="phone-big">Get ready!</div>
            <p>Everyone else is betting on you or {name(role === 'a' ? d.b : d.a)}.</p>
          </>
        )}
        {role === 'ref' && <RefControls pub={pub} onAction={refAct} compact />}
      </div>
    );
  }

  if (pub.phase === 'ready') {
    return (
      <div className="phone-center">
        <GameBanner info={info} role={role} />
        {role === 'ref' ? (
          <>
            <div className="phone-big">You’re the Host 🎤</div>
            <p>Read the instructions on the big screen, then start the round.</p>
          </>
        ) : (
          <>
            <div className="phone-big">{role === 'a' || role === 'b' ? 'Get ready!' : `${name(d.a)} vs ${name(d.b)}`}</div>
            <p className="muted">{d.ref ? `Waiting for ${name(d.ref)} to start the round…` : 'Waiting for the round to start…'}</p>
            {role === 'bettor' && <MyBet pub={pub} uid={uid} />}
          </>
        )}
        {role === 'ref' && <RefControls pub={pub} onAction={refAct} compact />}
      </div>
    );
  }

  if (pub.phase === 'duel') {
    const Views = GAME_VIEWS[d.gameId!];
    return (
      <div className="phone-duel">
        <GameBanner info={info} role={role} />
        {d.view && people && (role === 'a' || role === 'b') && (
          <Views.DuelistView view={d.view} people={people} side={role} now={now} send={(payload) => send({ t: 'game', payload })} />
        )}
        {d.view && people && role === 'ref' && (
          <>
            {Views.RefereeView ? (
              <Views.RefereeView view={d.view} people={people} now={now} send={(payload) => send({ t: 'game', payload })} />
            ) : (
              <div className="phone-center">
                <p>{info.refereeDuty}</p>
                <p className="muted">Watch the big screen.</p>
              </div>
            )}
            <RefControls pub={pub} onAction={refAct} compact />
          </>
        )}
        {role === 'bettor' &&
          (d.view && people && Views.AudienceView ? (
            <>
              <Views.AudienceView view={d.view} people={people} seat={uid} now={now} send={(payload) => send({ t: 'game', payload })} />
              <MyBet pub={pub} uid={uid} />
            </>
          ) : (
            <div className="phone-center">
              <div className="phone-big">
                {name(d.a)} vs {name(d.b)}
              </div>
              <p>Watch the big screen!</p>
              <MyBet pub={pub} uid={uid} />
            </div>
          ))}
      </div>
    );
  }

  // result
  const decided = d.winner && d.winner !== 'draw';
  const delta = pub.lastDelta?.[uid] ?? 0;
  const winnerId = decided ? d[d.winner as Side] : null;
  return (
    <div className="phone-center">
      {decided ? (
        <>
          <div className="phone-big">
            {winnerId === uid ? 'You won! 🎉' : role === 'a' || role === 'b' ? 'You lost 😵' : `${name(winnerId)} wins!`}
          </div>
          {d.kind === 'round' && delta !== 0 && <div className={`delta-big ${delta > 0 ? 'up' : 'down'}`}>{signed(delta)} 🪙</div>}
          {d.kind === 'round' && delta === 0 && role === 'bettor' && <p>No bet this round.</p>}
        </>
      ) : (
        <div className="phone-big">Draw!</div>
      )}
      {role === 'ref' ? <RefControls pub={pub} onAction={refAct} compact /> : <p className="muted">Waiting for the Host…</p>}
    </div>
  );
}

function GameBanner({ info, role }: { info: NonNullable<ReturnType<typeof gameInfo>>; role: PhaseProps['role'] }) {
  return (
    <div className="game-banner" style={{ background: info.color }}>
      <b>
        <GameIcon info={info} /> {info.name}
      </b>
      <small>{role === 'ref' ? info.refereeDuty : info.rules}</small>
    </div>
  );
}

// Remember this phone's own bet: the host keeps amounts secret until the round ends.
const betKey = (pub: PublicState) =>
  `${pub.code}-${pub.roundsPlayed}-${pub.duel?.a}-${pub.duel?.b}-${pub.duel?.gameId}`;
let lastBet: { key: string; on: Side; amount: number } | null = null;

function BetPanel({ pub, uid, send, now }: { pub: PublicState; uid: string; send: (m: PhoneMessage) => void; now: () => number }) {
  const d = pub.duel!;
  const me = pub.seats[uid];
  const max = Math.min(MAX_BET, me.coins);
  const [on, setOn] = useState<Side | null>(null);
  const [amount, setAmount] = useState(1);
  const locked = pub.betLocked.includes(uid);
  const key = betKey(pub);

  if (locked) {
    return (
      <>
        <div className="phone-big">Bet locked ✓</div>
        {lastBet?.key === key && (
          <p>
            {lastBet.amount} coin{lastBet.amount > 1 ? 's' : ''} on {pub.seats[d[lastBet.on]]?.name}
          </p>
        )}
        <p className="muted">Waiting for the others…</p>
      </>
    );
  }
  return (
    <div className="bet-panel">
      <div className="phone-row">
        <b>Who will win?</b>
        {pub.phaseEndsAt && <Countdown endsAt={pub.phaseEndsAt} now={now} total={BET_MS} size={52} />}
      </div>
      {pub.gifted.includes(uid) && <p className="gift">You were out of coins, so here’s 1 free coin to bet!</p>}
      <div className="bet-choices">
        {(['a', 'b'] as Side[]).map((s) => {
          const p = pub.seats[d[s]];
          return (
            <button key={s} className={`bet-choice${on === s ? ' on' : ''}`} onClick={() => setOn(s)}>
              <Character color={p.color} accessory={p.accessory} size={70} flip={s === 'b'} pose="still" />
              <b>{p.name}</b>
            </button>
          );
        })}
      </div>
      <div className="bet-amounts">
        {Array.from({ length: MAX_BET }, (_, i) => i + 1).map((n) => (
          <button key={n} className={`amount${amount === n ? ' on' : ''}`} disabled={n > max} onClick={() => setAmount(n)}>
            {n} 🪙
          </button>
        ))}
      </div>
      <button
        className="btn btn-primary btn-huge"
        disabled={!on}
        onClick={() => {
          if (!on) return;
          const amt = Math.min(amount, max);
          lastBet = { key, on, amount: amt };
          send({ t: 'bet', on, amount: amt });
        }}
      >
        {on ? `Lock in ${Math.min(amount, max)} on ${pub.seats[d[on]].name}` : 'Pick a player'}
      </button>
      <p className="muted small-print">No changing once you lock in. No bet in time = 1 coin on a random player.</p>
    </div>
  );
}

function MyBet({ pub, uid }: { pub: PublicState; uid: string }) {
  if (!pub.betLocked.includes(uid)) return null;
  const mine = lastBet && lastBet.key === betKey(pub) ? lastBet : null;
  return <p className="chip">{mine ? `Your bet: ${mine.amount} on ${pub.seats[pub.duel![mine.on]]?.name}` : 'Your bet is in'}</p>;
}
