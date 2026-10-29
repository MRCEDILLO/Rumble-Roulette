import { useRef } from 'react';
import { SPIN_MS } from '../engine/engine';
import type { Spin } from '../engine/types';
import { gameInfo } from '../games/logic';
import { useTicker } from './hooks';

const SPIN_TIME = SPIN_MS - 1200;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

/** Repeat the game list so the wheel always has at least 8 slices. */
function slicesFor(options: string[]) {
  const slices: string[] = [];
  while (slices.length < 8) slices.push(...options);
  return slices;
}

export function wheelAngle(spin: Spin, now: number) {
  const slices = slicesFor(spin.options);
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
  return (
    <div className="wheel" style={{ width: size, height: size }}>
      <svg viewBox="-260 -260 520 520" width={size} height={size} aria-label="Game wheel">
        <g transform={`rotate(${angle})`}>
          {slices.map((id, i) => {
            const info = gameInfo(id)!;
            const a0 = ((i * seg - 90) * Math.PI) / 180;
            const a1 = (((i + 1) * seg - 90) * Math.PI) / 180;
            const mid = ((i + 0.5) * seg - 90) * (Math.PI / 180);
            const path = `M0 0 L${r * Math.cos(a0)} ${r * Math.sin(a0)} A${r} ${r} 0 0 1 ${r * Math.cos(a1)} ${r * Math.sin(a1)} Z`;
            return (
              <g key={i}>
                <path d={path} fill={info.color} className="wheel-line" strokeWidth="5" opacity={i % 2 ? 0.85 : 1} />
                <g transform={`rotate(${(i + 0.5) * seg}) translate(0 ${-r * 0.62})`}>
                  <text textAnchor="middle" fontSize="44" y="0" dominantBaseline="middle">
                    {info.icon}
                  </text>
                </g>
                <text
                  x={Math.cos(mid) * r * 0.36}
                  y={Math.sin(mid) * r * 0.36}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="17"
                  fontWeight="800"
                  className="wheel-label"
                  transform={`rotate(${(i + 0.5) * seg - 90} ${Math.cos(mid) * r * 0.36} ${Math.sin(mid) * r * 0.36})`}
                >
                  {info.shortName ?? info.name}
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
