import { useEffect, useRef, useState } from 'react';
import type { PublicState } from '../engine/types';

/** Re-render every `ms` milliseconds (or every animation frame when ms is 0). */
export function useTicker(ms: number, active = true) {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (ms === 0) {
      let id = requestAnimationFrame(function loop() {
        setN((n) => n + 1);
        id = requestAnimationFrame(loop);
      });
      return () => cancelAnimationFrame(id);
    }
    const id = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms, active]);
}

/**
 * Estimate of the host's clock on this device. Deadlines in the game state are host timestamps,
 * so phones correct for their own clock being a little off.
 */
export function useHostClock(pub: PublicState | null): () => number {
  const offset = useRef(0);
  const lastHostNow = useRef<number | null>(null);
  if (pub && pub.hostNow !== lastHostNow.current) {
    lastHostNow.current = pub.hostNow;
    offset.current = pub.hostNow - Date.now();
  }
  return () => Date.now() + offset.current;
}

/** Run `fn` when `key` changes to a new value (not on first render). */
export function useOnChange<T>(key: T, fn: (key: T) => void) {
  const prev = useRef(key);
  useEffect(() => {
    if (prev.current !== key) {
      prev.current = key;
      fn(key);
    }
  });
}

/** Keep the phone screen on while in a game (where the browser allows it). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        /* not allowed right now */
      }
    };
    const onVisible = () => {
      if (!cancelled && document.visibilityState === 'visible') void request();
    };
    void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}

export function vibrate(pattern: number | number[] = 200) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}
