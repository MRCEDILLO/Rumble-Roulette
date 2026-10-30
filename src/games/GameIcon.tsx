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

const DRAWN: Record<string, () => JSX.Element> = {
  wanted: WantedPoster,
  snap: SnapCards,
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
