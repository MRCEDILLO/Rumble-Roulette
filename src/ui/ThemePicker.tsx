import { THEMES } from '../themes/themes';

/** Buttons to switch the look of the TV and the phones. */
export function ThemePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="toggle-row theme-picker" role="radiogroup" aria-label="Look">
      {THEMES.map((t) => (
        <button
          key={t.id}
          role="radio"
          aria-checked={value === t.id}
          className={`toggle theme-option${value === t.id ? ' on' : ''}`}
          onClick={() => onChange(t.id)}
        >
          <span className="theme-swatches" aria-hidden>
            {t.swatches.map((c) => (
              <i key={c} style={{ background: c }} />
            ))}
          </span>
          {t.name}
          <small>{t.blurb}</small>
        </button>
      ))}
    </div>
  );
}
