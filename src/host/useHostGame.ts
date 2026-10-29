import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addSeat,
  allTimeDeltas,
  applyInput,
  changeLook,
  emptyAllTimeStats,
  project,
  setConnected,
  tick,
} from '../engine/engine';
import type { EngineState, Profile } from '../engine/types';
import { ACCESSORIES, COLORS } from '../characters/looks';
import type { HostBackend, Inbound } from '../net/types';

const TICK_MS = 250;
const rng = Math.random;

const newId = () => Math.random().toString(36).slice(2, 12);

/**
 * Runs the game on the host: applies phone inputs and timers to the engine state,
 * then publishes the public view for the phones.
 */
export function useHostGame(backend: HostBackend, initial: EngineState, initialProfiles: Profile[]) {
  const code = initial.code;
  const stateRef = useRef(initial);
  const profilesRef = useRef(initialProfiles);
  const [state, setState] = useState(initial);
  const [profiles, setProfiles] = useState(initialProfiles);

  const publish = useCallback(() => {
    backend.publish(code, project(stateRef.current, profilesRef.current, Date.now()), stateRef.current);
  }, [backend, code]);

  const commit = useCallback(
    (next: EngineState) => {
      if (next === stateRef.current) return;
      stateRef.current = next;
      setState(next);
      publish();
    },
    [publish],
  );

  /** Apply a change to the latest state (safe to call from async handlers). */
  const update = useCallback((fn: (s: EngineState) => EngineState) => commit(fn(stateRef.current)), [commit]);

  const setProfileList = useCallback(
    (next: Profile[]) => {
      profilesRef.current = next;
      setProfiles(next);
      publish();
    },
    [publish],
  );

  // Phone messages.
  useEffect(() => {
    const handle = async ({ uid, msg }: Inbound) => {
      const now = Date.now();
      if (msg.t === 'join') {
        const p = profilesRef.current.find((x) => x.id === msg.profileId);
        if (!p) return;
        update((s) => addSeat(s, uid, p.id, { name: p.name, color: p.color, accessory: p.accessory }, now, rng));
        return;
      }
      if (msg.t === 'create') {
        const name = String(msg.look.name ?? '').trim().slice(0, 14);
        if (!name || !COLORS.some((c) => c.id === msg.look.color)) return;
        if (stateRef.current.seats[uid]) return;
        const taken = Object.values(stateRef.current.seats).some((seat) => seat.color === msg.look.color);
        if (taken) {
          update((s) => addSeat(s, uid, 'x', { ...msg.look, name }, now, rng));
          return;
        }
        const profile: Profile = {
          id: newId(),
          name,
          color: msg.look.color,
          accessory: msg.look.accessory,
          createdAt: now,
          stats: emptyAllTimeStats(),
        };
        setProfileList([...profilesRef.current, profile]);
        backend.saveProfile(profile).catch(console.error);
        update((s) => addSeat(s, uid, profile.id, { name, color: profile.color, accessory: profile.accessory }, now, rng));
        return;
      }
      if (msg.t === 'look') {
        if (!COLORS.some((c) => c.id === msg.color) || !ACCESSORIES.some((a) => a.id === msg.accessory)) return;
        update((s) => changeLook(s, uid, { color: msg.color, accessory: msg.accessory }, now));
        // Keep the profile in step so the new look sticks for next time.
        const seat = stateRef.current.seats[uid];
        const p = seat && profilesRef.current.find((x) => x.id === seat.profileId);
        if (p && (p.color !== seat.color || p.accessory !== seat.accessory)) {
          const updated = { ...p, color: seat.color, accessory: seat.accessory };
          setProfileList(profilesRef.current.map((x) => (x.id === p.id ? updated : x)));
          backend.saveProfile(updated).catch(console.error);
        }
        return;
      }
      update((s) => applyInput(s, uid, msg, now, rng));
    };
    return backend.onInbound(code, (m) => void handle(m));
  }, [backend, code, update, setProfileList]);

  // Who's connected.
  useEffect(
    () =>
      backend.onPresence(code, (uids) => {
        update((s) => {
          let next = s;
          for (const id of s.order) next = setConnected(next, id, uids.has(id));
          return next;
        });
      }),
    [backend, code, update],
  );

  // Timers.
  useEffect(() => {
    publish();
    const id = setInterval(() => update((s) => tick(s, Date.now(), rng)), TICK_MS);
    return () => clearInterval(id);
  }, [publish, update]);

  // Save all-time stats once a party game ends.
  useEffect(() => {
    const s = stateRef.current;
    if (s.phase !== 'end' || s.mode !== 'party' || s.statsSaved) return;
    const deltas = allTimeDeltas(s);
    const next = profilesRef.current.map((p) => {
      const d = deltas[p.id];
      if (!d) return p;
      const stats = { ...emptyAllTimeStats(), ...p.stats };
      for (const k of Object.keys(d) as (keyof typeof d)[]) stats[k] += d[k];
      const updated = { ...p, stats };
      backend.saveProfile(updated).catch(console.error);
      return updated;
    });
    setProfileList(next);
    backend
      .saveGameSummary({
        endedAt: Date.now(),
        rounds: s.totalRounds,
        champion: s.champion ? s.seats[s.champion]?.profileId ?? null : null,
        players: s.order.map((id) => ({ profileId: s.seats[id].profileId, name: s.seats[id].name, coins: s.seats[id].coins })),
        awards: s.awards.map((a) => ({ title: a.title, profiles: a.seats.map((id) => s.seats[id]?.profileId) })),
      })
      .catch(console.error);
    update((cur) => ({ ...cur, statsSaved: true }));
  }, [state.phase, backend, update, setProfileList]);

  return { state, profiles, update, setProfileList };
}
