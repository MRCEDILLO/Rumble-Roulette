import { colorById } from './looks';

export type Pose = 'idle' | 'still' | 'win' | 'lose';

interface Props {
  color: string;
  accessory: string;
  size?: number;
  pose?: Pose;
  /** Mirror the character so it faces left. */
  flip?: boolean;
  dim?: boolean;
  title?: string;
}

const INK = '#1b1035';

/** The Rumble Roulette Screenbot: a chunky robot whose screen face changes with the pose, plus one hat slot. */
export function Character({ color, accessory, size = 96, pose = 'idle', flip = false, dim = false, title }: Props) {
  const c = colorById(color);
  return (
    <svg
      className={`character pose-${pose}${dim ? ' dim' : ''}`}
      viewBox="0 -10 100 134"
      width={size}
      height={(size * 134) / 100}
      role="img"
      aria-label={title ?? `${c.name} character`}
    >
      <g transform={flip ? 'translate(100 0) scale(-1 1)' : undefined}>
       <g className="character-body">
        <ellipse cx="52" cy="119" rx="30" ry="4" fill="rgba(0,0,0,0.25)" />
        {/* legs and feet */}
        <rect x="34" y="92" width="14" height="18" rx="5" fill={c.shade} stroke={INK} strokeWidth="4" />
        <rect x="56" y="92" width="14" height="18" rx="5" fill={c.shade} stroke={INK} strokeWidth="4" />
        <rect x="30" y="106" width="20" height="8" rx="4" fill={INK} />
        <rect x="54" y="106" width="20" height="8" rx="4" fill={INK} />
        {/* bolt ears */}
        <circle cx="24" cy="48" r="6" fill={c.shade} stroke={INK} strokeWidth="4" />
        <circle cx="80" cy="48" r="6" fill={c.shade} stroke={INK} strokeWidth="4" />
        {/* body */}
        <rect x="26" y="22" width="52" height="74" rx="16" fill={c.main} stroke={INK} strokeWidth="4" />
        <path d="M32 86 C32 90 34 91 40 91" fill="none" stroke={c.shade} strokeWidth="5" strokeLinecap="round" />
        {/* screen */}
        <rect x="33" y="31" width="38" height="36" rx="10" fill={SCREEN} stroke={INK} strokeWidth="3.5" />
        <path d="M38 36 h10" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.35" />
        <Face pose={pose} />
        <circle cx="44" cy="80" r="3.5" fill={c.shade} />
        <circle cx="54" cy="80" r="3.5" fill={c.shade} />
        <circle cx="64" cy="80" r="3.5" fill={c.shade} />
        <Accessory id={accessory} />
       </g>
      </g>
    </svg>
  );
}

const SCREEN = '#22263a';
const GLOW = '#7dfcff';
const SAD_GLOW = '#ff8c8c';

function Face({ pose }: { pose: Pose }) {
  if (pose === 'win') {
    return (
      <g fill="none" stroke={GLOW} strokeWidth="3.5" strokeLinecap="round">
        <path d="M40 48 q5 -7 10 0 M56 48 q5 -7 10 0" />
        <path d="M45 56 q8 8 16 0" />
      </g>
    );
  }
  if (pose === 'lose') {
    return (
      <g fill="none" stroke={SAD_GLOW} strokeWidth="3.5" strokeLinecap="round">
        <path d="M41 42 l8 8 M49 42 l-8 8 M57 42 l8 8 M65 42 l-8 8" />
        <path d="M46 60 q7 -6 14 0" />
      </g>
    );
  }
  return (
    <g>
      <rect x="41" y="40" width="7" height="11" rx="3.5" fill={GLOW} />
      <rect x="58" y="40" width="7" height="11" rx="3.5" fill={GLOW} />
      <path d="M47 57 q6 4 12 0" fill="none" stroke={GLOW} strokeWidth="3.5" strokeLinecap="round" />
    </g>
  );
}

function Accessory({ id }: { id: string }) {
  switch (id) {
    case 'party':
      return (
        <g>
          <path d="M38 24 L54 -2 L66 22 Z" fill="#ff4d6d" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M44 15 L60 11 M48 7 L57 5" stroke="#ffd23f" strokeWidth="4" strokeLinecap="round" />
          <circle cx="54" cy="-1" r="5" fill="#ffd23f" stroke={INK} strokeWidth="3" />
        </g>
      );
    case 'crown':
      return (
        <path
          d="M34 24 L36 6 L45 15 L52 2 L59 15 L68 6 L70 24 Z"
          fill="#ffcc33"
          stroke={INK}
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
      );
    case 'cap':
      return (
        <g>
          <path d="M28 30 C28 12 76 10 78 28 Z" fill="#2f5bea" stroke={INK} strokeWidth="3.5" />
          <path d="M66 26 C78 24 92 26 96 31 L70 32 Z" fill="#2f5bea" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
          <circle cx="52" cy="13" r="3" fill={INK} />
        </g>
      );
    case 'beanie':
      return (
        <g>
          <path d="M28 30 C28 6 78 4 78 30 Z" fill="#26c485" stroke={INK} strokeWidth="3.5" />
          <rect x="25" y="24" width="56" height="10" rx="5" fill="#1a8f60" stroke={INK} strokeWidth="3.5" />
          <circle cx="53" cy="5" r="7" fill="#f2f2f5" stroke={INK} strokeWidth="3.5" />
        </g>
      );
    case 'headphones':
      // Band arcs over the head; the cups cover the bolt ears.
      return (
        <g>
          <path d="M23 42 C21 2 83 2 81 42" fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round" />
          <path d="M23 42 C21 2 83 2 81 42" fill="none" stroke="#ff4d6d" strokeWidth="3" strokeLinecap="round" />
          <rect x="15" y="36" width="15" height="24" rx="6" fill="#ff4d6d" stroke={INK} strokeWidth="3.5" />
          <rect x="74" y="36" width="15" height="24" rx="6" fill="#ff4d6d" stroke={INK} strokeWidth="3.5" />
          <path d="M19 42 v12 M85 42 v12" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
        </g>
      );
    case 'bow':
      return (
        <g>
          <path d="M52 20 L36 10 L36 30 Z" fill="#ff6fb5" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M52 20 L68 10 L68 30 Z" fill="#ff6fb5" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
          <circle cx="52" cy="20" r="5" fill="#ff9ccf" stroke={INK} strokeWidth="3.5" />
        </g>
      );
    case 'chef':
      return (
        <g>
          <rect x="34" y="14" width="36" height="12" rx="3" fill="#ffffff" stroke={INK} strokeWidth="3.5" />
          <path
            d="M34 16 C24 14 24 -2 38 2 C40 -8 64 -8 66 2 C80 -2 80 14 70 16 Z"
            fill="#ffffff"
            stroke={INK}
            strokeWidth="3.5"
          />
        </g>
      );
    case 'halo':
      return (
        <g>
          <ellipse cx="52" cy="6" rx="19" ry="5.5" fill="none" stroke={INK} strokeWidth="8" />
          <ellipse cx="52" cy="6" rx="19" ry="5.5" fill="none" stroke="#ffe066" strokeWidth="4" />
          <path d="M40 3 q4 -2 8 -2.5" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
        </g>
      );
    case 'tophat':
      return (
        <g>
          <rect x="36" y="-8" width="32" height="30" rx="3" fill="#2b2d3a" stroke={INK} strokeWidth="3.5" />
          <rect x="36" y="13" width="32" height="6" fill="#e5383b" stroke={INK} strokeWidth="3" />
          <ellipse cx="52" cy="23" rx="28" ry="5" fill="#2b2d3a" stroke={INK} strokeWidth="3.5" />
          <path d="M41 -3 v12" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" opacity="0.3" />
        </g>
      );
    case 'fedora':
      return (
        <g>
          <path d="M34 22 C34 6 40 0 52 5 C64 0 70 6 70 22 Z" fill="#b07d4f" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M34.5 15 C46 18 58 18 69.5 15 L70 21 C58 23 46 23 34 21 Z" fill="#3b2a1d" />
          <path d="M14 24 C28 14 76 14 90 24 C76 31 28 31 14 24 Z" fill="#b07d4f" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
        </g>
      );
    case 'shades':
      // Sits over the screen face, arms hook onto the bolt ears.
      return (
        <g>
          <path d="M24 44 L34 42 M70 42 L80 44" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
          <path d="M33 38 h19 v6 c0 6 -4 9 -9.5 9 c-5.5 0 -9.5 -3 -9.5 -9 Z" fill="#111320" stroke="#ff4d6d" strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M52 38 h19 v6 c0 6 -4 9 -9.5 9 c-5.5 0 -9.5 -3 -9.5 -9 Z" fill="#111320" stroke="#ff4d6d" strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M37 42 l5 -2 M56 42 l5 -2" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
        </g>
      );
    case 'sombrero':
      return (
        <g>
          <ellipse cx="52" cy="22" rx="44" ry="8" fill="#f2c14e" stroke={INK} strokeWidth="3.5" />
          <path d="M37 21 C37 -6 67 -6 67 21 Z" fill="#f2c14e" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M38 14 l4 -4 l4 4 l4 -4 l4 4 l4 -4 l4 4 l4 -4 l4 4" fill="none" stroke="#e5383b" strokeWidth="3" strokeLinejoin="round" />
          <path d="M37.5 18 h29" stroke="#1f9d55" strokeWidth="3" />
          <circle cx="12" cy="26" r="3" fill="#e5383b" stroke={INK} strokeWidth="2" />
          <circle cx="92" cy="26" r="3" fill="#e5383b" stroke={INK} strokeWidth="2" />
          <circle cx="32" cy="29.5" r="3" fill="#1f9d55" stroke={INK} strokeWidth="2" />
          <circle cx="72" cy="29.5" r="3" fill="#1f9d55" stroke={INK} strokeWidth="2" />
        </g>
      );
    case 'banana':
      // A peel flopped on the head, flaps hanging down the sides and front.
      return (
        <g strokeLinejoin="round">
          <rect x="48" y="-6" width="8" height="10" rx="2.5" fill="#6b4a2b" stroke={INK} strokeWidth="3" />
          <path d="M40 26 C40 10 46 2 52 2 C58 2 64 10 64 26 Z" fill="#ffe066" stroke={INK} strokeWidth="3.5" />
          <path d="M44 18 C32 16 22 26 19 42 C28 41 38 34 46 26 Z" fill="#ffe066" stroke={INK} strokeWidth="3.5" />
          <path d="M60 18 C72 16 82 26 85 42 C76 41 66 34 58 26 Z" fill="#ffe066" stroke={INK} strokeWidth="3.5" />
          <path d="M45 22 C42 32 46 42 52 42 C58 42 62 32 59 22 Z" fill="#fff3b0" stroke={INK} strokeWidth="3.5" />
          <path d="M47 8 C46 14 46 18 47 22" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
          <circle cx="22" cy="39" r="2.2" fill="#6b4a2b" />
          <circle cx="82" cy="39" r="2.2" fill="#6b4a2b" />
          <circle cx="52" cy="39" r="2" fill="#6b4a2b" />
        </g>
      );
    default:
      return null;
  }
}
