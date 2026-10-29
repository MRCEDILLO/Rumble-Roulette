import type { ComponentType } from 'react';
import type { Throw } from './logic';

const INK = 'var(--line, #1d1a2e)';

function Rock() {
  return (
    <>
      <path
        d="M14 70 C8 58 12 42 24 34 C30 22 46 16 60 20 C74 22 86 34 88 50 C92 62 86 76 74 82 C60 88 34 88 22 82 C16 78 15 74 14 70 Z"
        fill="#a3abbd"
      />
      <path d="M17 71 C32 80 62 82 87 62 C86 74 80 79 74 82 C60 88 34 88 22 82 C18 79 17 75 17 71 Z" fill="#737c93" />
      <path
        d="M14 70 C8 58 12 42 24 34 C30 22 46 16 60 20 C74 22 86 34 88 50 C92 62 86 76 74 82 C60 88 34 88 22 82 C16 78 15 74 14 70 Z"
        fill="none"
        stroke={INK}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path d="M29 39 C35 31 44 27 53 27" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.75" />
      <path d="M52 46 L60 55 L57 65 M60 55 L69 57" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="34" cy="60" r="3" fill="#737c93" />
      <circle cx="74" cy="42" r="2.5" fill="#737c93" />
    </>
  );
}

function Paper() {
  return (
    <g transform="rotate(-7 50 50)">
      <path d="M22 8 H64 L80 24 V92 H22 Z" fill="#fff" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      <path d="M34 10 V90" stroke="#ff5a3c" strokeWidth="2.5" />
      {[38, 50, 62, 74].map((y) => (
        <path key={y} d={`M40 ${y} H72`} stroke="#59c3ff" strokeWidth="3.5" strokeLinecap="round" />
      ))}
      <path d="M64 8 V24 H80 Z" fill="#dfe6f2" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
    </g>
  );
}

function Scissors() {
  const handle = (cx: number) => (
    <>
      <path d={`M50 56 L${cx < 50 ? 38 : 62} 68`} stroke={INK} strokeWidth="12" strokeLinecap="round" />
      <path d={`M50 56 L${cx < 50 ? 38 : 62} 68`} stroke="#ff5a3c" strokeWidth="5" strokeLinecap="round" />
      <circle cx={cx} cy="78" r="12" fill="none" stroke={INK} strokeWidth="14" />
      <circle cx={cx} cy="78" r="12" fill="none" stroke="#ff5a3c" strokeWidth="6" />
    </>
  );
  return (
    <>
      <path d="M56 60 L25 7 Q18 7 19 14 L44 62 Z" fill="#dfe6f2" stroke={INK} strokeWidth="4.5" strokeLinejoin="round" />
      {handle(72)}
      <path d="M44 60 L75 7 Q82 7 81 14 L56 62 Z" fill="#eef2f8" stroke={INK} strokeWidth="4.5" strokeLinejoin="round" />
      <path d="M52 50 L72 15" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
      {handle(28)}
      <circle cx="50" cy="56" r="5.5" fill="#ffd23f" stroke={INK} strokeWidth="3.5" />
    </>
  );
}

const PICTURES: Record<Throw, ComponentType> = { rock: Rock, paper: Paper, scissors: Scissors };

/** A drawn rock, sheet of paper or pair of scissors, in the cartoon ink style. */
export function ThrowPicture({ pick, size = 48, className = '' }: { pick: Throw; size?: number; className?: string }) {
  const Picture = PICTURES[pick];
  return (
    <svg className={`throw-pic ${className}`} viewBox="0 0 100 100" width={size} height={size} aria-hidden>
      <Picture />
    </svg>
  );
}
