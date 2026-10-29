import type { EngineState, Look, PlayerInput, Profile, PublicState } from '../engine/types';

/** Messages a phone sends to the host. */
export type PhoneMessage =
  | PlayerInput
  | { t: 'join'; profileId: string }
  | { t: 'create'; look: Look }
  | { t: 'look'; color: string; accessory: string };

export interface Inbound {
  uid: string;
  msg: PhoneMessage;
}

export interface HostUser {
  uid: string;
  name: string;
  photo: string | null;
}

/** Everything the host screen needs from the backend. */
export interface HostBackend {
  kind: 'firebase' | 'local';
  /** Watch the host's sign-in state. */
  onAuth(cb: (user: HostUser | null) => void): () => void;
  signIn(): Promise<void>;
  signOut(): Promise<void>;

  createRoom(): Promise<string>;
  /** Saved engine state for a room this host made earlier (to resume after a refresh). */
  loadRoom(code: string): Promise<EngineState | null>;
  closeRoom(code: string): Promise<void>;
  publish(code: string, pub: PublicState, full: EngineState): void;
  onInbound(code: string, cb: (msg: Inbound) => void): () => void;
  /** Called with the set of phone uids currently connected. */
  onPresence(code: string, cb: (uids: Set<string>) => void): () => void;

  listProfiles(): Promise<Profile[]>;
  saveProfile(p: Profile): Promise<void>;
  deleteProfile(id: string): Promise<void>;
  saveGameSummary(summary: unknown): Promise<void>;
  /** Trivia questions this host has already had, by category id. */
  loadTriviaMemory(): Promise<Record<string, string[]>>;
  saveTriviaMemory(category: string, used: string[]): Promise<void>;
}

/** Everything a phone needs from the backend. */
export interface PhoneBackend {
  kind: 'firebase' | 'local';
  /** Resolves with this phone's stable id. */
  ready(): Promise<string>;
  roomExists(code: string): Promise<boolean>;
  watch(code: string, cb: (pub: PublicState | null) => void): () => void;
  send(code: string, msg: PhoneMessage): void;
}
