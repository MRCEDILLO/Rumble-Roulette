export function Logo({ size = 'small' }: { size?: 'small' | 'big' }) {
  return (
    <div className={`logo logo-${size}`}>
      <span className="logo-wheel" aria-hidden>
        🎡
      </span>
      <span className="logo-text">
        Rumble <em>Roulette</em>
      </span>
    </div>
  );
}
