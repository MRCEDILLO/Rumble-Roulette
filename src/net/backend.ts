import { firebaseConfig } from '../firebase-config';
import { firebaseHostBackend, firebasePhoneBackend } from './firebase';
import { localHostBackend, localPhoneBackend } from './local';
import type { HostBackend, PhoneBackend } from './types';

/** Offline demo mode when Firebase isn't set up yet, or when the URL has ?local. */
export const useLocal =
  !firebaseConfig.apiKey || !firebaseConfig.databaseURL || new URLSearchParams(location.search).has('local');

let host: HostBackend | null = null;
let phone: PhoneBackend | null = null;

export function hostBackend(): HostBackend {
  host ??= useLocal ? localHostBackend() : firebaseHostBackend();
  return host;
}

export function phoneBackend(): PhoneBackend {
  phone ??= useLocal ? localPhoneBackend() : firebasePhoneBackend();
  return phone;
}
