import { useRef } from 'react';
import { SPIN_MS, shuffle } from '../engine/engine';
import type { Spin } from '../engine/types';
import { gameInfo } from '../games/logic';
import { useTicker } from './hooks';

const SPIN_TIME = SPIN_MS - 1200;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

/** The most games the wheel shows. More than this and the slices get too thin to read. */
export const MAX_WHEEL_GAMES = 12;

/** A tiny seeded random generator (mulberry32), so a spin always draws the same wheel. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The games on the wheel for this spin. A big pool shows the chosen game plus a random
 * handful of the others, picked from the spin's start time so every redraw matches.
 */
export function wheelGames(spin: Spin): string[] {
  if (spin.options.length <= MAX_WHEEL_GAMES) return spin.options;
  const rng = seeded(spin.startedAt);
  const others = shuffle(
    spin.options.filter((id) => id !== spin.gameId),
    rng,
  ).slice(0, MAX_WHEEL_GAMES - 1);
  return shuffle([spin.gameId, ...others], rng);
}

/** Repeat the game list so the wheel always has at least 8 slices. */
function slicesFor(options: string[]) {
  const slices: string[] = [];
  while (slices.length < 8) slices.push(...options);
  return slices;
}

export function wheelAngle(spin: Spin, now: number) {
  const slices = slicesFor(wheelGames(spin));
  const seg = 360 / slices.length;
  const target = slices.indexOf(spin.gameId); // first slice showing the chosen game
  const final = spin.turns * 360 + (360 - (target + 0.5) * seg);
  const t = Math.min(1, Math.max(0, (now - spin.startedAt) / SPIN_TIME));
  return { angle: final * easeOut(t), done: t >= 1, slices, seg };
}

interface Props {
  spin: Spin;
  now: () => number;
  size?: number;
  onTick?: () => void;
}

export function Wheel({ spin, now, size = 520, onTick }: Props) {
  const { angle, done, slices, seg } = wheelAngle(spin, now());
  useTicker(0, !done);
  const lastSlice = useRef(-1);
  const slice = Math.floor(angle / seg);
  if (onTick && slice !== lastSlice.current) {
    if (lastSlice.current !== -1 && !done) onTick();
    lastSlice.current = slice;
  }
  const r = 240;
  // Names run from just outside the hub to just inside the icons.
  const LABEL_FROM = 44;
  const LABEL_ROOM = r * 0.8 - 26 - LABEL_FROM;
  return (
    <div className="wheel" style={{ width: size, height: size }}>
      <svg viewBox="-260 -260 520 520" width={size} height={size} aria-label="Game wheel">
        <g transform={`rotate(${angle})`}>
          {slices.map((id, i) => {
            const info = gameInfo(id)!;
            const label = info.shortName ?? info.name;
            const a0 = ((i * seg - 90) * Math.PI) / 180;
            const a1 = (((i + 1) * seg - 90) * Math.PI) / 180;
            const mid = ((i + 0.5) * seg - 90) * (Math.PI / 180);
            const path = `M0 0 L${r * Math.cos(a0)} ${r * Math.sin(a0)} A${r} ${r} 0 0 1 ${r * Math.cos(a1)} ${r * Math.sin(a1)} Z`;
            return (
              <g key={i}>
                <path d={path} fill={info.color} className="wheel-line" strokeWidth="5" opacity={i % 2 ? 0.85 : 1} />
                <g transform={`rotate(${(i + 0.5) * seg}) translate(0 ${-r * 0.8})`}>
                  <text textAnchor="middle" fontSize="38" y="0" dominantBaseline="middle">
                    {info.icon}
                  </text>
                </g>
                {/* The name reads outwards from the hub and is squeezed to fit before the icon. */}
                <text
                  x={Math.cos(mid) * LABEL_FROM}
                  y={Math.sin(mid) * LABEL_FROM}
                  dominantBaseline="middle"
                  fontSize="17"
                  fontWeight="800"
                  className="wheel-label"
                  transform={`rotate(${(i + 0.5) * seg - 90} ${Math.cos(mid) * LABEL_FROM} ${Math.sin(mid) * LABEL_FROM})`}
                  {...(label.length * 9.5 > LABEL_ROOM ? { textLength: LABEL_ROOM, lengthAdjust: 'spacingAndGlyphs' } : {})}
                >
                  {label}
                </text>
              </g>
            );
          })}
        </g>
        <circle r={r + 6} className="wheel-rim" strokeWidth="12" />
        {slices.map((_, i) => {
          const a = ((i * seg + angle - 90) * Math.PI) / 180;
          return <circle key={i} className="wheel-stud" cx={(r + 6) * Math.cos(a)} cy={(r + 6) * Math.sin(a)} r="5" />;
        })}
        <circle r="34" className="wheel-hub" strokeWidth="6" />
        <path d="M-24 -258 L24 -258 L0 -212 Z" className="wheel-pointer" strokeWidth="5" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
