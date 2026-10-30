import { useState } from 'react';
import { Character } from '../characters/Character';
import type { Mode, Profile } from '../engine/types';
import { ALL_CATEGORY_IDS, CATEGORIES } from '../games/categories';
import { CategoryIcon } from '../games/CategoryIcon';
import { GameIcon } from '../games/GameIcon';
import { ALL_GAME_IDS, gameInfo, matchesSearch } from '../games/logic';
import type { GameCategory } from '../games/types';
import type { HostUser } from '../net/types';
import { FullscreenButton } from '../ui/common';
import { Logo } from '../ui/Logo';
import { ThemePicker } from '../ui/ThemePicker';

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
/** Games this browser has seen in setup, so games added later start ticked. */
const KNOWN_KEY = 'rr-known-games';
/** The games that existed before KNOWN_KEY was added. */
const FIRST_GAMES = ['rps', 'timer'];
/** Same for categories, so categories added later start on. */
const KNOWN_CATEGORIES_KEY = 'rr-known-categories';
const FIRST_CATEGORIES: GameCategory[] = ['trivia', 'word', 'chance', 'physical', 'misc'];

function loadEnabled(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(GAMES_KEY) ?? 'null') as string[] | null;
    const known = (JSON.parse(localStorage.getItem(KNOWN_KEY) ?? 'null') as string[] | null) ?? FIRST_GAMES;
    const added = ALL_GAME_IDS.filter((id) => !known.includes(id));
    const valid = saved?.filter((id) => ALL_GAME_IDS.includes(id));
    return valid?.length ? [...valid, ...added.filter((id) => !valid.includes(id))] : ALL_GAME_IDS;
  } catch {
    return ALL_GAME_IDS;
  }
}

function loadCategories(): GameCategory[] {
  try {
    const saved = JSON.parse(localStorage.getItem(CATEGORIES_KEY) ?? 'null') as GameCategory[] | null;
    const known =
      (JSON.parse(localStorage.getItem(KNOWN_CATEGORIES_KEY) ?? 'null') as GameCategory[] | null) ?? FIRST_CATEGORIES;
    const added = ALL_CATEGORY_IDS.filter((id) => !known.includes(id));
    // An empty saved list is kept: the host turned every category off on purpose.
    return saved ? [...saved.filter((id) => ALL_CATEGORY_IDS.includes(id) && !added.includes(id)), ...added] : ALL_CATEGORY_IDS;
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
  theme: string;
  onTheme: (id: string) => void;
}

export function Setup({ user, profiles, error, onCreate, onSignOut, onDeleteProfile, theme, onTheme }: Props) {
  const [mode, setMode] = useState<Mode>('party');
  const [length, setLength] = useState('short');
  const [custom, setCustom] = useState(15);
  const [games, setGames] = useState<string[]>(loadEnabled);
  const [categories, setCategories] = useState<GameCategory[]>(loadCategories);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Profile | null>(null);
  const [search, setSearch] = useState('');
  const [openGroups, setOpenGroups] = useState<GameCategory[]>([]);

  const rounds = length === 'custom' ? custom : LENGTHS.find((l) => l.id === length)!.rounds;
  const toggleGame = (id: string) => {
    const next = games.includes(id) ? games.filter((g) => g !== id) : [...games, id];
    setGames(next);
    save(GAMES_KEY, next);
    save(KNOWN_KEY, ALL_GAME_IDS);
  };
  const setMany = (ids: string[], on: boolean) => {
    const next = on ? [...games, ...ids.filter((id) => !games.includes(id))] : games.filter((g) => !ids.includes(g));
    setGames(next);
    save(GAMES_KEY, next);
    save(KNOWN_KEY, ALL_GAME_IDS);
  };
  const toggleGroup = (id: GameCategory) =>
    setOpenGroups((open) => (open.includes(id) ? open.filter((c) => c !== id) : [...open, id]));
  const toggleCategory = (id: GameCategory) => {
    const next = categories.includes(id) ? categories.filter((c) => c !== id) : [...categories, id];
    setCategories(next);
    save(CATEGORIES_KEY, next);
    save(KNOWN_CATEGORIES_KEY, ALL_CATEGORY_IDS);
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
        <div className="setup-brand">
          <a className="btn btn-quiet btn-small" href="#/">
            ← Back
          </a>
          <Logo />
        </div>
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
          {poolProblem ? (
            <p className="error">{poolProblem}</p>
          ) : (
            <p className="muted pool-count">
              {pool.length === 1 ? '1 game' : `${pool.length} games`} on the wheel, out of {ALL_GAME_IDS.length}.
            </p>
          )}
          {error && <p className="error">{error}</p>}

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
                  <span className="toggle-title">
                    <CategoryIcon id={c.id} /> {c.name}
                  </span>
                  <small>{count === 1 ? '1 game' : `${count} games`}</small>
                </button>
              );
            })}
          </div>

          <div className="games-heading">
            <h2>Games on the wheel</h2>
            <input
              type="search"
              className="game-search"
              placeholder="Find a game…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="game-groups">
            {CATEGORIES.filter((c) => categories.includes(c.id)).map((c) => {
              const all = shownGames.filter((id) => gameInfo(id)!.category === c.id);
              if (!all.length) return null;
              const matches = all.filter((id) => matchesSearch(id, search));
              if (!matches.length) return null;
              const on = all.filter((id) => games.includes(id)).length;
              // A search opens every group that has a match.
              const open = search.trim() !== '' || openGroups.includes(c.id);
              return (
                <div key={c.id} className={`game-group${open ? ' open' : ''}`}>
                  <div className="game-group-head">
                    <button className="game-group-toggle" aria-expanded={open} onClick={() => toggleGroup(c.id)}>
                      <span className="chevron" aria-hidden="true">
                        ▸
                      </span>
                      <CategoryIcon id={c.id} />
                      <b>{c.name}</b>
                      <small>
                        {on} of {all.length} on
                      </small>
                    </button>
                    <button className="btn btn-quiet btn-small" disabled={on === all.length} onClick={() => setMany(all, true)}>
                      All
                    </button>
                    <button className="btn btn-quiet btn-small" disabled={on === 0} onClick={() => setMany(all, false)}>
                      None
                    </button>
                  </div>
                  {open && (
                    <div className="game-list">
                      {matches.map((id) => {
                        const info = gameInfo(id)!;
                        return (
                          <label key={id} className={`game-pick${games.includes(id) ? ' on' : ''}`} title={info.rules}>
                            <input type="checkbox" checked={games.includes(id)} onChange={() => toggleGame(id)} />
                            <span className="game-icon" style={{ background: info.color }}>
                              <GameIcon info={info} />
                            </span>
                            <span>
                              <b>{info.name}</b>
                              <small>{info.rules}</small>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {shownGames.length === 0 && <p className="muted">No games here. Turn a category on above.</p>}
            {shownGames.length > 0 && !shownGames.some((id) => matchesSearch(id, search)) && (
              <p className="muted">No games match “{search}”.</p>
            )}
          </div>
        </section>

        <div className="setup-side">
        <section className="card">
          <h2>Theme</h2>
          <p className="muted">How the TV and the phones look. Saved on your account, and you can change it mid-game from the menu.</p>
          <ThemePicker value={theme} onChange={onTheme} />
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
                    onClick={() => setDeleting(p)}
                  >
                    Delete
                  </button>
                </li>
              ))}
          </ul>
        </section>
        </div>
      </div>

      {deleting && (
        <ConfirmDelete
          profile={deleting}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            onDeleteProfile(deleting.id);
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}

function ConfirmDelete({ profile, onCancel, onConfirm }: { profile: Profile; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="modal-backdrop dialog-backdrop" onClick={onCancel}>
      <div
        className="dialog card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        onClick={(e) => e.stopPropagation()}
      >
        <Character color={profile.color} accessory={profile.accessory} size={72} pose="still" />
        <h2 id="delete-title">Delete {profile.name}?</h2>
        <p>
          Are you sure you want to delete this profile? This deletes <b>{profile.name}</b> and all of their data, including
          their all-time stats. It can’t be undone.
        </p>
        <div className="row-buttons">
          <button className="btn" onClick={onCancel} autoFocus>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={onConfirm}>
            Delete profile
          </button>
        </div>
      </div>
    </div>
  );
}
