import type { JSX } from 'react';
import type { GameCategory } from './types';

const INK = '#1d1a2e';

// Drawn icons keep the same colours in every look: the dark outline reads on the
// gold "on" toggle, Casino felt and Arcade neon alike.

function Puzzle() {
  return (
    <path
      d="M10 14 H19 A5.5 5.5 0 1 1 29 14 H38 V21 A5.5 5.5 0 1 1 38 31 V40 H10 V31 A5.5 5.5 0 1 0 10 21 Z"
      fill="#3fcf6e"
      stroke={INK}
      strokeWidth="3"
      strokeLinejoin="round"
    />
  );
}

function AceOfHearts() {
  return (
    <g transform="rotate(-8 24 24)">
      <rect x="10" y="5" width="28" height="38" rx="4" fill="#fff" stroke={INK} strokeWidth="3" />
      <path d="M13.5 18 L16.5 9.5 L19.5 18 M14.6 15 H18.4" fill="none" stroke="#e8283c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M24 36 C14 29 13 22 18 20 C21 19 23 21 24 23 C25 21 27 19 30 20 C35 22 34 29 24 36 Z"
        fill="#e8283c"
        stroke={INK}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </g>
  );
}

function Dumbbell() {
  return (
    <g stroke={INK} strokeWidth="2.5" strokeLinejoin="round">
      <rect x="10" y="19.5" width="28" height="9" rx="2" fill="#b8c0d0" />
      <rect x="3" y="9" width="10" height="30" rx="3" fill="#ff5a3c" />
      <rect x="35" y="9" width="10" height="30" rx="3" fill="#ff5a3c" />
      <path d="M6.5 13 V22 M38.5 13 V22" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
    </g>
  );
}

/** A grab bag of shapes: one of everything. */
function Assorted() {
  return (
    <g stroke={INK} strokeWidth="2.5" strokeLinejoin="round">
      <rect x="25" y="25" width="16" height="16" rx="2.5" fill="#8b5cf6" transform="rotate(10 33 33)" />
      <path d="M17 6 L28 25 H6 Z" fill="#2ec4b6" />
      <circle cx="14" cy="34" r="8" fill="#ff6fb5" />
      <circle cx="36" cy="13" r="5" fill="#3a8dff" />
    </g>
  );
}

const ICONS: Record<GameCategory, string | (() => JSX.Element)> = {
  trivia: '🧠',
  word: '🔤',
  chance: '🎲',
  puzzle: Puzzle,
  card: AceOfHearts,
  physical: Dumbbell,
  misc: Assorted,
};

export function CategoryIcon({ id }: { id: GameCategory }) {
  const Drawing = ICONS[id];
  if (typeof Drawing === 'string') return <span className="category-icon">{Drawing}</span>;
  return (
    <svg className="category-icon" viewBox="0 0 48 48" aria-hidden="true">
      <Drawing />
    </svg>
  );
}
