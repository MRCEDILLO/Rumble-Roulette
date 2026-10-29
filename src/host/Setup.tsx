import { useState } from 'react';
import { Character } from '../characters/Character';
import type { Mode, Profile } from '../engine/types';
import { ALL_CATEGORY_IDS, CATEGORIES } from '../games/categories';
import { ALL_GAME_IDS, gameInfo } from '../games/logic';
import type { GameCategory } from '../games/types';
import type { HostUser } from '../net/types';
import { FullscreenButton } from '../ui/common';
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
const CATEGORIES_KEY = 'rr-enabled-categories';

function loadEnabled(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(GAMES_KEY) ?? 'null') as string[] | null;
    const valid = saved?.filter((id) => ALL_GAME_IDS.includes(id));
    return valid?.length ? valid : ALL_GAME_IDS;
  } catch {
    return ALL_GAME_IDS;
  }
}

function loadCategories(): GameCategory[] {
  try {
    const saved = JSON.parse(localStorage.getItem(CATEGORIES_KEY) ?? 'null') as GameCategory[] | null;
    // An empty saved list is kept: the host turned every category off on purpose.
    return saved ? saved.filter((id) => ALL_CATEGORY_IDS.includes(id)) : ALL_CATEGORY_IDS;
  } catch {
    return ALL_CATEGORY_IDS;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode etc: the choice just isn't remembered.
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
  const [categories, setCategories] = useState<GameCategory[]>(loadCategories);
  const [busy, setBusy] = useState(false);

  const rounds = length === 'custom' ? custom : LENGTHS.find((l) => l.id === length)!.rounds;
  const toggleGame = (id: string) => {
    const next = games.includes(id) ? games.filter((g) => g !== id) : [...games, id];
    setGames(next);
    save(GAMES_KEY, next);
  };
  const toggleCategory = (id: GameCategory) => {
    const next = categories.includes(id) ? categories.filter((c) => c !== id) : [...categories, id];
    setCategories(next);
    save(CATEGORIES_KEY, next);
  };
  const shownGames = ALL_GAME_IDS.filter((id) => categories.includes(gameInfo(id)!.category));
  // The wheel's pool: games that are ticked and whose category is on.
  const pool = shownGames.filter((id) => games.includes(id));
  const poolProblem =
    categories.length === 0
      ? 'Turn on at least one category.'
      : shownGames.length === 0
        ? 'There are no games in those categories yet. Turn on another category.'
        : pool.length === 0
          ? 'Turn on at least one game.'
          : null;

  return (
    <div className="screen setup">
      <header className="setup-header">
        <Logo />
        <div className="setup-user">
          {user.photo && <img src={user.photo} alt="" />}
          <span>{user.name}</span>
          <FullscreenButton />
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
              <small>Coins, bets, a Host each round and a final</small>
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

          <h2>Categories on the wheel</h2>
          <div className="toggle-row">
            {CATEGORIES.map((c) => {
              const count = ALL_GAME_IDS.filter((id) => gameInfo(id)!.category === c.id).length;
              return (
                <button
                  key={c.id}
                  className={`toggle${categories.includes(c.id) ? ' on' : ''}`}
                  aria-pressed={categories.includes(c.id)}
                  onClick={() => toggleCategory(c.id)}
                >
                  {c.icon} {c.name}
                  <small>{count === 1 ? '1 game' : `${count} games`}</small>
                </button>
              );
            })}
          </div>

          <h2>Games on the wheel</h2>
          <div className="game-list">
            {shownGames.map((id) => {
              const info = gameInfo(id)!;
              const category = CATEGORIES.find((c) => c.id === info.category)!;
              return (
                <label key={id} className={`game-pick${games.includes(id) ? ' on' : ''}`}>
                  <input type="checkbox" checked={games.includes(id)} onChange={() => toggleGame(id)} />
                  <span className="game-icon" style={{ background: info.color }}>
                    {info.icon}
                  </span>
                  <span>
                    <b>{info.name}</b>
                    <small>{info.rules}</small>
                    <small className="tag">{category.name}</small>
                    {info.needsReferee && <small className="tag">Needs a Host</small>}
                  </span>
                </label>
              );
            })}
            {shownGames.length === 0 && <p className="muted">No games here. Turn a category on above.</p>}
          </div>

          <button
            className="btn btn-primary btn-huge"
            disabled={busy || poolProblem !== null}
            onClick={async () => {
              setBusy(true);
              await onCreate({ mode, rounds, games: pool });
              setBusy(false);
            }}
          >
            {busy ? 'Creating room…' : 'Create room'}
          </button>
          {poolProblem && <p className="error">{poolProblem}</p>}
          {error && <p className="error">{error}</p>}
        </section>

        <section className="card">
          <h2>Profiles ({profiles.length})</h2>
          <p className="muted">Players pick or create these on their phone when they join, and see their own all-time stats there.</p>
          {profiles.length === 0 && <p>No profiles yet.</p>}
          <ul className="profile-list">
            {[...profiles]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((p) => (
                <li key={p.id}>
                  <Character color={p.color} accessory={p.accessory} size={40} pose="still" />
                  <span className="profile-name">{p.name}</span>
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
