import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  get,
  getDatabase,
  onChildAdded,
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  serverTimestamp,
  set,
} from 'firebase/database';
import { collection, deleteDoc, doc, getDocs, getFirestore, addDoc, setDoc } from 'firebase/firestore';
import type { EngineState, Profile, PublicState } from '../engine/types';
import { firebaseConfig } from '../firebase-config';
import { newRoomCode } from './roomCode';
import type { HostBackend, HostUser, PhoneBackend } from './types';

let app: FirebaseApp | null = null;
function firebase() {
  app ??= initializeApp(firebaseConfig);
  return { auth: getAuth(app), db: getDatabase(app), fs: getFirestore(app) };
}

const toHostUser = (u: User | null): HostUser | null =>
  u && !u.isAnonymous ? { uid: u.uid, name: u.displayName ?? 'Host', photo: u.photoURL } : null;

export function firebaseHostBackend(): HostBackend {
  const { auth, db, fs } = firebase();
  const uid = () => {
    if (!auth.currentUser) throw new Error('Not signed in');
    return auth.currentUser.uid;
  };
  const lastPub = new Map<string, string>();

  return {
    kind: 'firebase',
    onAuth(cb) {
      return onAuthStateChanged(auth, (u) => cb(toHostUser(u)));
    },
    async signIn() {
      await signInWithPopup(auth, new GoogleAuthProvider());
    },
    async signOut() {
      await signOut(auth);
    },
    async createRoom() {
      for (let attempt = 0; attempt < 20; attempt++) {
        const code = newRoomCode();
        const meta = ref(db, `rooms/${code}/meta`);
        if ((await get(meta)).exists()) continue;
        await set(meta, { hostUid: uid(), createdAt: serverTimestamp() });
        return code;
      }
      throw new Error('Could not find a free room code. Try again.');
    },
    async loadRoom(code) {
      try {
        const snap = await get(ref(db, `rooms/${code}/host`));
        return snap.exists() ? (JSON.parse(snap.val()) as EngineState) : null;
      } catch {
        return null;
      }
    },
    async closeRoom(code) {
      await remove(ref(db, `rooms/${code}`)).catch(() => undefined);
    },
    publish(code, pub, full) {
      // Stored as JSON strings: the Realtime Database drops empty arrays and undefined values.
      set(ref(db, `rooms/${code}/host`), JSON.stringify(full)).catch(console.error);
      const json = JSON.stringify(pub);
      if (lastPub.get(code) === json) return;
      lastPub.set(code, json);
      set(ref(db, `rooms/${code}/state`), json).catch(console.error);
    },
    onInbound(code, cb) {
      return onChildAdded(ref(db, `rooms/${code}/inputs`), (snap) => {
        const v = snap.val() as { uid: string; msg: string };
        remove(snap.ref).catch(() => undefined);
        try {
          cb({ uid: v.uid, msg: JSON.parse(v.msg) });
        } catch (err) {
          console.error('Bad input', err);
        }
      });
    },
    onPresence(code, cb) {
      return onValue(ref(db, `rooms/${code}/presence`), (snap) => {
        cb(new Set(Object.keys(snap.val() ?? {})));
      });
    },
    async listProfiles() {
      const snap = await getDocs(collection(fs, 'hosts', uid(), 'profiles'));
      return snap.docs.map((d) => d.data() as Profile);
    },
    async saveProfile(p) {
      await setDoc(doc(fs, 'hosts', uid(), 'profiles', p.id), p);
    },
    async deleteProfile(id) {
      await deleteDoc(doc(fs, 'hosts', uid(), 'profiles', id));
    },
    async saveGameSummary(summary) {
      await addDoc(collection(fs, 'hosts', uid(), 'games'), summary as object);
    },
    async loadTriviaMemory() {
      const snap = await getDocs(collection(fs, 'hosts', uid(), 'trivia'));
      return Object.fromEntries(snap.docs.map((d) => [d.id, (d.data().used as string[] | undefined) ?? []]));
    },
    async saveTriviaMemory(category, used) {
      await setDoc(doc(fs, 'hosts', uid(), 'trivia', category), { used, updatedAt: Date.now() });
    },
  };
}

export function firebasePhoneBackend(): PhoneBackend {
  const { auth, db } = firebase();
  const ready = new Promise<string>((resolve, reject) => {
    const stop = onAuthStateChanged(auth, (u) => {
      if (u) {
        stop();
        resolve(u.uid);
      } else {
        signInAnonymously(auth).catch(reject);
      }
    });
  });

  return {
    kind: 'firebase',
    ready: () => ready,
    async roomExists(code) {
      await ready;
      return (await get(ref(db, `rooms/${code}/meta`))).exists();
    },
    watch(code, cb) {
      let stopped = false;
      const unsubs: (() => void)[] = [];
      ready.then((uid) => {
        if (stopped) return;
        unsubs.push(
          onValue(ref(db, `rooms/${code}/state`), (snap) => {
            cb(snap.exists() ? (JSON.parse(snap.val()) as PublicState) : null);
          }),
        );
        // Mark this phone as here, and have the server clear it if the connection drops.
        const presence = ref(db, `rooms/${code}/presence/${uid}`);
        unsubs.push(
          onValue(ref(db, '.info/connected'), (snap) => {
            if (snap.val() !== true) return;
            onDisconnect(presence)
              .remove()
              .then(() => set(presence, true))
              .catch(console.error);
          }),
        );
        unsubs.push(() => {
          remove(presence).catch(() => undefined);
        });
      });
      return () => {
        stopped = true;
        unsubs.forEach((u) => u());
      };
    },
    send(code, msg) {
      ready.then((uid) =>
        push(ref(db, `rooms/${code}/inputs`), { uid, msg: JSON.stringify(msg), at: serverTimestamp() }).catch(
          console.error,
        ),
      );
    },
  };
}
