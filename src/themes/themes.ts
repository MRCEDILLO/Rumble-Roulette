/**
 * Visual themes ("looks") for the whole site. Each theme is a CSS file scoped to
 * `:root[data-theme="<id>"]` that sets the design tokens used by styles.css, plus
 * any decoration of its own. Add a theme by adding a CSS file, importing it in
 * main.tsx and adding an entry here. The host picks one in setup or the menu; it is
 * saved on their account and sent to the phones with the room state.
 */
export interface Theme {
  id: string;
  name: string;
  /** One line for the picker. */
  blurb: string;
  /** A few colours for the picker's preview. */
  swatches: string[];
  /** Google Fonts stylesheet with the theme's typefaces. */
  fontsHref: string;
  /** Browser UI colour on phones. */
  themeColor: string;
}

export const THEMES: Theme[] = [
  {
    id: 'cartoon',
    name: 'Saturday cartoon',
    blurb: 'Bright sky, sunburst and chunky outlines',
    swatches: ['#59c3ff', '#ffd23f', '#ff5a3c', '#3fcf6e'],
    fontsHref: 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Bowlby+One&display=swap',
    themeColor: '#59c3ff',
  },
  {
    id: 'casino',
    name: 'Casino felt',
    blurb: 'Green felt table, gold trim and poker chips',
    swatches: ['#0f5c3f', '#e8c15a', '#f6ecd2', '#c8323c'],
    fontsHref:
      'https://fonts.googleapis.com/css2?family=Alfa+Slab+One&family=Barlow+Condensed:wght@500;600;700&display=swap',
    themeColor: '#0f5c3f',
  },
];

export const DEFAULT_THEME = THEMES[0].id;

/** This browser's last theme, so a refresh doesn't flash the default first. */
const LAST_KEY = 'rr-theme';

export function themeById(id: string | null | undefined) {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function lastTheme() {
  try {
    return themeById(localStorage.getItem(LAST_KEY)).id;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Switch the page to a theme: tokens, fonts and the phone's browser colour. */
export function applyTheme(id: string | null | undefined) {
  const theme = themeById(id);
  if (document.documentElement.dataset.theme !== theme.id) document.documentElement.dataset.theme = theme.id;
  const fonts = document.getElementById('theme-fonts') as HTMLLinkElement | null;
  if (fonts && fonts.href !== theme.fontsHref) fonts.href = theme.fontsHref;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.themeColor);
  try {
    localStorage.setItem(LAST_KEY, theme.id);
  } catch {
    // Private mode: the next refresh starts on the default look.
  }
}
