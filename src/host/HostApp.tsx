import { useEffect, useState } from 'react';
import { createState } from '../engine/engine';
import type { EngineState, Mode, Profile } from '../engine/types';
import { hostBackend, useLocal } from '../net/backend';
import type { HostUser } from '../net/types';
import { LoadingMark, Logo } from '../ui/Logo';
import { Room } from './Room';
import { Setup, type SetupChoice } from './Setup';

const ROOM_KEY = 'rr-host-room';

export function HostApp() {
  const backend = hostBackend();
  const [user, setUser] = useState<HostUser | null | undefined>(undefined);
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [game, setGame] = useState<EngineState | null>(null);
  const [resuming, setResuming] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => backend.onAuth(setUser), [backend]);

  // Once signed in: load profiles, and pick up a game that was running before a refresh.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await backend.listProfiles();
        if (cancelled) return;
        setProfiles(list);
        const saved = localStorage.getItem(ROOM_KEY);
        if (saved) {
          const state = await backend.loadRoom(saved);
          if (!cancelled && state) setGame(state);
        }
      } catch (err) {
        setError(String(err));
      } finally {
        if (!cancelled) setResuming(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, backend]);

  if (user === undefined)
    return (
      <div className="screen center">
        <LoadingMark size={140} />
      </div>
    );

  if (!user) {
    return (
      <div className="screen center host-signin">
        <a className="btn btn-quiet btn-small back-link" href="#/">
          ← Back
        </a>
        <Logo size="big" />
        <p className="lead">Sign in to host a game. Players join on their phones, no account needed.</p>
        <button className="btn btn-primary btn-huge" onClick={() => backend.signIn().catch((e) => setError(String(e)))}>
          {useLocal ? 'Start hosting (offline demo)' : 'Sign in with Google'}
        </button>
        {useLocal && (
          <p className="muted small-print">
            Offline demo mode: Firebase isn't set up yet, so players join from other tabs in this browser.
          </p>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  if (resuming || !profiles)
    return (
      <div className="screen center">
        <LoadingMark size={140} label="Loading your profiles" />
        <p className="lead">Loading your profiles…</p>
      </div>
    );

  if (!game) {
    const create = async (choice: SetupChoice) => {
      setError(null);
      try {
        const old = localStorage.getItem(ROOM_KEY);
        if (old) await backend.closeRoom(old);
        const code = await backend.createRoom();
        localStorage.setItem(ROOM_KEY, code);
        setGame(createState(code, choice.mode as Mode, choice.rounds, choice.games, Date.now()));
      } catch (err) {
        setError(String(err));
      }
    };
    return (
      <Setup
        user={user}
        profiles={profiles}
        error={error}
        onCreate={create}
        onSignOut={async () => {
          await backend.signOut();
          // Back to the landing page so the next person can choose Join or Host.
          location.hash = '#/';
        }}
        onDeleteProfile={async (id) => {
          await backend.deleteProfile(id);
          setProfiles(profiles.filter((p) => p.id !== id));
        }}
      />
    );
  }

  return (
    <Room
      key={game.code}
      backend={backend}
      initial={game}
      profiles={profiles}
      onClose={async () => {
        await backend.closeRoom(game.code);
        localStorage.removeItem(ROOM_KEY);
        setProfiles(await backend.listProfiles());
        setGame(null);
      }}
    />
  );
}
