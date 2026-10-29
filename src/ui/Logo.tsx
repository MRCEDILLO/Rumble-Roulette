const R = 84;
const POCKETS = 8;

function point(deg: number, r: number) {
  const t = ((deg - 90) * Math.PI) / 180;
  return `${(100 + r * Math.cos(t)).toFixed(2)} ${(100 + r * Math.sin(t)).toFixed(2)}`;
}

const seg = 360 / POCKETS;
const pockets = Array.from({ length: POCKETS }, (_, i) => {
  const a0 = i * seg - seg / 2;
  return `M100 100 L${point(a0, R)} A${R} ${R} 0 0 1 ${point(a0 + seg, R)} Z`;
});

function Sword({ angle }: { angle: number }) {
  return (
    <g transform={`rotate(${angle} 100 100)`} className="outline" strokeWidth="5" strokeLinejoin="round">
      <path className="blade" d="M100 12 L107.5 27 L107.5 124 L92.5 124 L92.5 27 Z" />
      <path className="fuller" d="M100 22 L100 118" strokeWidth="3" strokeLinecap="round" />
      <rect className="grip" x="95" y="134" width="10" height="26" rx="4" />
      <rect className="hilt" x="74" y="122" width="52" height="12" rx="6" />
      <circle className="hilt" cx="100" cy="167" r="8" />
    </g>
  );
}

/** The Rumble Roulette mark: a roulette wheel with two crossed swords. Colours come from the theme. */
export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <svg className={`logo-mark ${className}`} viewBox="-14 -14 228 228" aria-hidden>
      <g className="wheel-spin">
        {pockets.map((d, i) => (
          <path key={i} d={d} className={i % 2 ? 'wedge-b' : 'wedge-a'} />
        ))}
        <circle className="rim" cx="100" cy="100" r={R} strokeWidth="11" />
        {pockets.map((_, i) => {
          const [x, y] = point(i * seg - seg / 2, R).split(' ');
          return <circle key={i} className="stud" cx={x} cy={y} r="3.4" />;
        })}
      </g>
      <circle className="hub outline" cx="100" cy="100" r="30" strokeWidth="5" />
      <Sword angle={-42} />
      <Sword angle={42} />
    </svg>
  );
}

/** Loading icon: the logo mark with only the wheel ring spinning (the swords stay still). */
export function LoadingMark({ size = 96, label = 'Loading' }: { size?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} style={{ ['--loading-size' as string]: `${size}px` }}>
      <LogoMark className="loading-mark" />
    </div>
  );
}

/** Small: the mark beside the name, for top bars. Big: the stacked lockup for the main screens. */
export function Logo({ size = 'small' }: { size?: 'small' | 'big' }) {
  return (
    <div className={`logo logo-${size}`} role="img" aria-label="Rumble Roulette">
      <LogoMark />
      <span className="logo-text" aria-hidden>
        {size === 'big' ? (
          <>
            <span>Rumble</span>
            <span>Roulette</span>
          </>
        ) : (
          'Rumble Roulette'
        )}
      </span>
    </div>
  );
}
