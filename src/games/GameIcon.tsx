import type { JSX } from 'react';
import type { GameInfo } from './types';

const INK = '#1d1a2e';

// Drawn game icons, in the same style as CategoryIcon.tsx. A game without one
// here shows its emoji `icon` instead.

/** A nailed-up WANTED poster with a cowboy-hatted outlaw. */
function WantedPoster() {
  return (
    <g transform="rotate(-6 24 24)" strokeLinejoin="round">
      <path d="M9 4 H39 V41 L35 44 L31 41 L27 44 L23 41 L19 44 L15 41 L9 44 Z" fill="#f3d9a4" stroke={INK} strokeWidth="2.5" />
      <rect x="12" y="8.5" width="24" height="7" rx="1" fill="#8a3b12" />
      <text x="24" y="14" textAnchor="middle" fontSize="6" fontWeight="900" fill="#f3d9a4" fontFamily="Arial, sans-serif" textLength="21" lengthAdjust="spacingAndGlyphs">
        WANTED
      </text>
      <rect x="13" y="18" width="22" height="18" rx="1.5" fill="#e6c27f" stroke={INK} strokeWidth="1.5" />
      <path d="M17 36 C17 31 20 29.5 24 29.5 C28 29.5 31 31 31 36 Z" fill={INK} />
      <circle cx="24" cy="27" r="4.2" fill={INK} />
      <path d="M15.5 23.6 C19 25 29 25 32.5 23.6 L29.6 22.6 L28.6 18.8 C26.6 19.8 21.4 19.8 19.4 18.8 L18.4 22.6 Z" fill="#8a3b12" stroke={INK} strokeWidth="1.2" />
      <circle cx="24" cy="5.5" r="1.8" fill="#9aa3b5" stroke={INK} strokeWidth="1.2" />
    </g>
  );
}

/** Two matching cards slapped down side by side, with a snap spark between them. */
function SnapCards() {
  const star = (cx: number, cy: number) =>
    Array.from({ length: 10 }, (_, i) => {
      const r = i % 2 ? 2.6 : 6;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
  return (
    <g strokeLinejoin="round">
      <g transform="rotate(-12 15 28)">
        <rect x="5" y="14" width="19" height="27" rx="3" fill="#fffdf6" stroke={INK} strokeWidth="2.5" />
        <polygon points={star(14.5, 27.5)} fill="#e5383b" stroke="#e5383b" strokeWidth="1" />
      </g>
      <g transform="rotate(12 33 28)">
        <rect x="24" y="14" width="19" height="27" rx="3" fill="#fffdf6" stroke={INK} strokeWidth="2.5" />
        <polygon points={star(33.5, 27.5)} fill="#e5383b" stroke="#e5383b" strokeWidth="1" />
      </g>
      <path d="M24 3 V9 M16 5 L19 10 M32 5 L29 10" stroke="#ffc21a" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

/** Three letter tiles tipped out of order, with a swap arrow over them. */
function ScrambleTiles() {
  const tile = (x: number, y: number, tilt: number, letter: string) => (
    <g transform={`rotate(${tilt} ${x + 7} ${y + 7})`}>
      <rect x={x} y={y} width="14" height="14" rx="2.5" fill="#ffd23f" stroke={INK} strokeWidth="2.2" />
      <text x={x + 7} y={y + 11.2} textAnchor="middle" fontSize="10.5" fontWeight="900" fill={INK} fontFamily="Arial, sans-serif">
        {letter}
      </text>
    </g>
  );
  return (
    <g strokeLinejoin="round">
      {tile(2.5, 25, -10, 'T')}
      {tile(17, 28, 6, 'A')}
      {tile(31.5, 24, -5, 'C')}
      <path d="M10 19 C14 8 34 8 38 18" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M33.5 17 L38.5 19.5 L40.5 14" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
    </g>
  );
}

/** An Ace of spades fanned over a King of hearts: blackjack. */
function BlackjackCards() {
  return (
    <g strokeLinejoin="round">
      <g transform="rotate(-14 18 30)">
        <rect x="6" y="10" width="21" height="30" rx="3" fill="#fffdf6" stroke={INK} strokeWidth="2.5" />
        <text x="11.5" y="19.5" textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#d62839" fontFamily="Arial, sans-serif">
          K
        </text>
        <path d="M16.5 34 C11 30 9.5 27 10.5 25 C11.5 23 15 23 16.5 26 C18 23 21.5 23 22.5 25 C23.5 27 22 30 16.5 34 Z" fill="#d62839" />
      </g>
      <g transform="rotate(10 30 30)">
        <rect x="20" y="8" width="21" height="30" rx="3" fill="#fffdf6" stroke={INK} strokeWidth="2.5" />
        <text x="25.5" y="17.5" textAnchor="middle" fontSize="8.5" fontWeight="900" fill={INK} fontFamily="Arial, sans-serif">
          A
        </text>
        <path d="M31 17 C27 21.5 24.5 23.5 25 26 C25.5 28.5 29 28.8 30.3 27 L29 32 H33 L31.7 27 C33 28.8 36.5 28.5 37 26 C37.5 23.5 35 21.5 31 17 Z" fill={INK} />
      </g>
    </g>
  );
}

/** A two-faced chess clock, one button pressed down and one up. */
function ChessClock() {
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      <rect x="11" y="11" width="8" height="5" rx="1.5" fill="#ff5a3c" stroke={INK} strokeWidth="2.2" />
      <rect x="29" y="7" width="8" height="9" rx="1.5" fill="#ffd23f" stroke={INK} strokeWidth="2.2" />
      <path d="M4 16 H44 L41 42 H7 Z" fill="#4cc9f0" stroke={INK} strokeWidth="2.5" />
      <circle cx="15" cy="28" r="8" fill="#fffdf6" stroke={INK} strokeWidth="2.2" />
      <circle cx="33" cy="28" r="8" fill="#fffdf6" stroke={INK} strokeWidth="2.2" />
      <path d="M15 28 V22.5 M15 28 L18.5 30" fill="none" stroke={INK} strokeWidth="2" />
      <path d="M33 28 V22.5 M33 28 L29 26" fill="none" stroke="#ff5a3c" strokeWidth="2" />
    </g>
  );
}

/** A letter tile with a red no-entry sign across it: Forbidden Categories. */
function ForbiddenTile() {
  return (
    <g strokeLinejoin="round">
      <rect x="9" y="9" width="30" height="30" rx="4" fill="#ffd23f" stroke={INK} strokeWidth="2.5" transform="rotate(-6 24 24)" />
      <text x="24" y="33" textAnchor="middle" fontSize="24" fontWeight="900" fill={INK} fontFamily="Arial, sans-serif" transform="rotate(-6 24 24)">
        A
      </text>
      <circle cx="24" cy="24" r="19" fill="none" stroke="#e5383b" strokeWidth="5" />
      <path d="M10.6 10.6 L37.4 37.4" stroke="#e5383b" strokeWidth="5" />
    </g>
  );
}

const DRAWN: Record<string, () => JSX.Element> = {
  wanted: WantedPoster,
  snap: SnapCards,
  blackjack: BlackjackCards,
  scramble: ScrambleTiles,
  'category-clash': ChessClock,
  'forbidden-categories': ForbiddenTile,
};

/** The drawing for a game, if it has one, as SVG content on a 48×48 canvas. */
export function drawnGameIcon(id: string) {
  return DRAWN[id];
}

export function GameIcon({ info }: { info: Pick<GameInfo, 'id' | 'icon'> }) {
  const Drawing = DRAWN[info.id];
  if (!Drawing) return <>{info.icon}</>;
  return (
    <svg className="drawn-game-icon" viewBox="0 0 48 48" aria-hidden="true">
      <Drawing />
    </svg>
  );
}
