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

/** The Rumble Roulette bean: a simple character with a visor, a backpack and one hat slot. */
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
        <ellipse cx="50" cy="119" rx="30" ry="4" fill="rgba(0,0,0,0.25)" />
        {/* backpack */}
        <rect x="12" y="50" width="18" height="40" rx="7" fill={c.shade} stroke={INK} strokeWidth="4" />
        {/* legs */}
        <rect x="30" y="92" width="16" height="24" rx="7" fill={c.shade} stroke={INK} strokeWidth="4" />
        <rect x="56" y="92" width="16" height="24" rx="7" fill={c.shade} stroke={INK} strokeWidth="4" />
        {/* body */}
        <path
          d="M24 56 C24 30 36 20 52 20 C70 20 80 32 80 56 L80 92 C80 102 74 106 64 106 L40 106 C30 106 24 102 24 92 Z"
          fill={c.main}
          stroke={INK}
          strokeWidth="4"
        />
        <path d="M30 88 C30 98 36 100 44 100" fill="none" stroke={c.shade} strokeWidth="5" strokeLinecap="round" />
        {/* visor */}
        <rect x="46" y="36" width="42" height="24" rx="12" fill="#9be4ff" stroke={INK} strokeWidth="4" />
        <rect x="56" y="41" width="20" height="6" rx="3" fill="#ffffff" opacity="0.85" />
        {pose === 'lose' && <path d="M90 30 q4 8 0 10 q-4 -2 0 -10z" fill="#9be4ff" stroke={INK} strokeWidth="2" />}
        <Accessory id={accessory} />
       </g>
      </g>
    </svg>
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
      return (
        <g>
          <path d="M26 46 C22 6 84 4 82 46" fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" />
          <path d="M26 46 C22 6 84 4 82 46" fill="none" stroke="#ff4d6d" strokeWidth="3" strokeLinecap="round" />
          <rect x="18" y="38" width="12" height="20" rx="5" fill="#ff4d6d" stroke={INK} strokeWidth="3.5" />
          <rect x="76" y="36" width="12" height="20" rx="5" fill="#ff4d6d" stroke={INK} strokeWidth="3.5" />
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
    default:
      return null;
  }
}
