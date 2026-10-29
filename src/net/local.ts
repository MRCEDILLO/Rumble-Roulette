/**
 * Offline backend: everything lives in this browser. Open the host in one tab and players in
 * other tabs of the same browser. Used automatically when Firebase isn't configured, and by tests.
 */
import type { EngineState, Profile, PublicState } from '../engine/types';
import { newRoomCode } from './roomCode';
import type { HostBackend, HostUser, Inbound, PhoneBackend, PhoneMessage } from './types';

const KEY = {
  user: 'rr-local-user',
  profiles: 'rr-local-profiles',
  games: 'rr-local-games',
  room: (code: string) => `rr-local-room-${code}`,
  pub: (code: string) => `rr-local-pub-${code}`,
  phone: 'rr-local-phone-id',
};

const HEARTBEAT_MS = 1_500;
const PRESENCE_TIMEOUT_MS = 5_000;

type Wire =
  | { kind: 'state'; json: string }
  | { kind: 'input'; uid: string; msg: PhoneMessage }
  | { kind: 'hello'; uid: string };

const channel = (code: string) => new BroadcastChannel(`rr-room-${code}`);

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked: the game still works, it just won't survive a refresh
  }
}

export function localHostBackend(): HostBackend {
  const authListeners = new Set<(u: HostUser | null) => void>();
  const channels = new Map<string, BroadcastChannel>();
  const getChannel = (code: string) => {
    let ch = channels.get(code);
    if (!ch) {
      ch = channel(code);
      channels.set(code, ch);
    }
    return ch;
  };
  const lastPub = new Map<string, string>();

  return {
    kind: 'local',
    onAuth(cb) {
      authListeners.add(cb);
      cb(readJson<HostUser | null>(KEY.user, null));
      return () => authListeners.delete(cb);
    },
    async signIn() {
      const user = { uid: 'local-host', name: 'Local host', photo: null };
      writeJson(KEY.user, user);
      authListeners.forEach((cb) => cb(user));
    },
    async signOut() {
      localStorage.removeItem(KEY.user);
      authListeners.forEach((cb) => cb(null));
    },
    async createRoom() {
      return newRoomCode();
    },
    async loadRoom(code) {
      return readJson<EngineState | null>(KEY.room(code), null);
    },
    async closeRoom(code) {
      localStorage.removeItem(KEY.room(code));
      localStorage.removeItem(KEY.pub(code));
      channels.get(code)?.close();
      channels.delete(code);
    },
    publish(code, pub, full) {
      const json = JSON.stringify(pub);
      writeJson(KEY.room(code), full);
      if (lastPub.get(code) === json) return;
      lastPub.set(code, json);
      localStorage.setItem(KEY.pub(code), json);
      getChannel(code).postMessage({ kind: 'state', json } satisfies Wire);
    },
    onInbound(code, cb) {
      const ch = getChannel(code);
      const handler = (e: MessageEvent<Wire>) => {
        if (e.data.kind === 'input') cb({ uid: e.data.uid, msg: e.data.msg } satisfies Inbound);
        if (e.data.kind === 'hello') {
          // A phone just arrived: send it the latest state straight away.
          const json = lastPub.get(code);
          if (json) ch.postMessage({ kind: 'state', json } satisfies Wire);
        }
      };
      ch.addEventListener('message', handler);
      return () => ch.removeEventListener('message', handler);
    },
    onPresence(code, cb) {
      const ch = getChannel(code);
      const seen = new Map<string, number>();
      const handler = (e: MessageEvent<Wire>) => {
        if (e.data.kind === 'hello') seen.set(e.data.uid, Date.now());
      };
      ch.addEventListener('message', handler);
      const timer = setInterval(() => {
        const now = Date.now();
        cb(new Set([...seen].filter(([, at]) => now - at < PRESENCE_TIMEOUT_MS).map(([uid]) => uid)));
      }, 1_000);
      return () => {
        ch.removeEventListener('message', handler);
        clearInterval(timer);
      };
    },
    async listProfiles() {
      return readJson<Profile[]>(KEY.profiles, []);
    },
    async saveProfile(p) {
      const all = readJson<Profile[]>(KEY.profiles, []).filter((x) => x.id !== p.id);
      writeJson(KEY.profiles, [...all, p]);
    },
    async deleteProfile(id) {
      writeJson(
        KEY.profiles,
        readJson<Profile[]>(KEY.profiles, []).filter((x) => x.id !== id),
      );
    },
    async saveGameSummary(summary) {
      writeJson(KEY.games, [...readJson<unknown[]>(KEY.games, []), summary].slice(-50));
    },
  };
}

export function localPhoneBackend(): PhoneBackend {
  // One id per tab, kept across refreshes, so several tabs can be several players.
  let uid = sessionStorage.getItem(KEY.phone);
  if (!uid) {
    uid = `local-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(KEY.phone, uid);
  }
  const id = uid;
  const channels = new Map<string, BroadcastChannel>();
  const getChannel = (code: string) => {
    let ch = channels.get(code);
    if (!ch) {
      ch = channel(code);
      channels.set(code, ch);
    }
    return ch;
  };

  return {
    kind: 'local',
    async ready() {
      return id;
    },
    async roomExists(code) {
      return localStorage.getItem(KEY.pub(code)) !== null;
    },
    watch(code, cb) {
      const ch = getChannel(code);
      const cached = localStorage.getItem(KEY.pub(code));
      cb(cached ? (JSON.parse(cached) as PublicState) : null);
      const handler = (e: MessageEvent<Wire>) => {
        if (e.data.kind === 'state') cb(JSON.parse(e.data.json) as PublicState);
      };
      ch.addEventListener('message', handler);
      const hello = () => ch.postMessage({ kind: 'hello', uid: id } satisfies Wire);
      hello();
      const timer = setInterval(hello, HEARTBEAT_MS);
      return () => {
        ch.removeEventListener('message', handler);
        clearInterval(timer);
      };
    },
    send(code, msg) {
      getChannel(code).postMessage({ kind: 'input', uid: id, msg } satisfies Wire);
    },
  };
}
