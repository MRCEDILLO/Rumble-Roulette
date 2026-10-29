import { useState } from 'react';
import { Character } from '../characters/Character';
import type { Mode, Profile } from '../engine/types';
import { ALL_GAME_IDS, gameInfo } from '../games/logic';
import type { HostUser } from '../net/types';
import { Logo } from '../ui/Logo';

export interface SetupChoice {
  mode: Mode;
  rounds: number;
  games: string[];
}

const LENGTHS = [
  { id: 'short', label: 'Short', rounds: 10 },
  { id: 'medium', label: 'Medium', rounds: 20 },
  { id: 'long', label: 'Long', rounds: 30 },
];

const GAMES_KEY = 'rr-enabled-games';

function loadEnabled(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(GAMES_KEY) ?? 'null') as string[] | null;
    const valid = saved?.filter((id) => ALL_GAME_IDS.includes(id));
    return valid?.length ? valid : ALL_GAME_IDS;
  } catch {
    return ALL_GAME_IDS;
  }
}

interface Props {
  user: HostUser;
  profiles: Profile[];
  error: string | null;
  onCreate: (c: SetupChoice) => void;
  onSignOut: () => void;
  onDeleteProfile: (id: string) => void;
}

export function Setup({ user, profiles, error, onCreate, onSignOut, onDeleteProfile }: Props) {
  const [mode, setMode] = useState<Mode>('party');
  const [length, setLength] = useState('short');
  const [custom, setCustom] = useState(15);
  const [games, setGames] = useState<string[]>(loadEnabled);
  const [busy, setBusy] = useState(false);
  const [showProfiles, setShowProfiles] = useState(false);

  const rounds = length === 'custom' ? custom : LENGTHS.find((l) => l.id === length)!.rounds;
  const toggleGame = (id: string) => {
    const next = games.includes(id) ? games.filter((g) => g !== id) : [...games, id];
    setGames(next);
    localStorage.setItem(GAMES_KEY, JSON.stringify(next));
  };

  return (
    <div className="screen setup">
      <header className="setup-header">
        <Logo />
        <div className="setup-user">
          {user.photo && <img src={user.photo} alt="" />}
          <span>{user.name}</span>
          <button className="btn btn-quiet btn-small" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <div className="setup-grid">
        <section className="card">
          <h2>Mode</h2>
          <div className="toggle-row">
            <button className={`toggle${mode === 'party' ? ' on' : ''}`} onClick={() => setMode('party')}>
              🎉 Party
              <small>Coins, bets, referee and a final</small>
            </button>
            <button className={`toggle${mode === 'free' ? ' on' : ''}`} onClick={() => setMode('free')}>
              🕹️ Free play
              <small>Pick any game, no coins</small>
            </button>
          </div>

          {mode === 'party' && (
            <>
              <h2>Game length</h2>
              <div className="toggle-row">
                {LENGTHS.map((l) => (
                  <button key={l.id} className={`toggle${length === l.id ? ' on' : ''}`} onClick={() => setLength(l.id)}>
                    {l.label}
                    <small>{l.rounds} rounds</small>
                  </button>
                ))}
                <button className={`toggle${length === 'custom' ? ' on' : ''}`} onClick={() => setLength('custom')}>
                  Custom
                  <small>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={custom}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        setLength('custom');
                        setCustom(Math.max(1, Math.min(99, Number(e.target.value) || 1)));
                      }}
                    />{' '}
                    rounds
                  </small>
                </button>
              </div>
            </>
          )}

          <h2>Games on the wheel</h2>
          <div className="game-list">
            {ALL_GAME_IDS.map((id) => {
              const info = gameInfo(id)!;
              return (
                <label key={id} className={`game-pick${games.includes(id) ? ' on' : ''}`}>
                  <input type="checkbox" checked={games.includes(id)} onChange={() => toggleGame(id)} />
                  <span className="game-icon" style={{ background: info.color }}>
                    {info.icon}
                  </span>
                  <span>
                    <b>{info.name}</b>
                    <small>{info.rules}</small>
                    {info.needsReferee && <small className="tag">Needs a referee</small>}
                  </span>
                </label>
              );
            })}
          </div>

          <button
            className="btn btn-primary btn-huge"
            disabled={busy || games.length === 0}
            onClick={async () => {
              setBusy(true);
              await onCreate({ mode, rounds, games });
              setBusy(false);
            }}
          >
            {busy ? 'Creating room…' : 'Create room'}
          </button>
          {games.length === 0 && <p className="error">Turn on at least one game.</p>}
          {error && <p className="error">{error}</p>}
        </section>

        <section className="card">
          <h2>Profiles ({profiles.length})</h2>
          <p className="muted">Players pick or create these on their phone when they join.</p>
          {profiles.length === 0 && <p>No profiles yet.</p>}
          <button className="btn btn-quiet btn-small" onClick={() => setShowProfiles(!showProfiles)}>
            {showProfiles ? 'Hide' : 'Show'} all-time stats
          </button>
          <ul className="profile-list">
            {[...profiles]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((p) => (
                <li key={p.id}>
                  <Character color={p.color} accessory={p.accessory} size={40} pose="still" />
                  <span className="profile-name">{p.name}</span>
                  {showProfiles && <StatLine p={p} />}
                  <button
                    className="btn btn-quiet btn-small"
                    onClick={() => confirm(`Delete ${p.name} and their stats?`) && onDeleteProfile(p.id)}
                  >
                    Delete
                  </button>
                </li>
              ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

export function StatLine({ p }: { p: Profile }) {
  const s = p.stats;
  const duels = s.duelWins + s.duelLosses;
  return (
    <span className="stat-line">
      {s.gamesWon}🏆 · duels {s.duelWins}-{s.duelLosses}
      {duels ? ` (${Math.round((100 * s.duelWins) / duels)}%)` : ''} · bet on {s.betsOn} · against {s.betsAgainst}
    </span>
  );
}
