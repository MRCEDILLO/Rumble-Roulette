/**
 * Visual themes ("looks") for the whole site. Each theme is a CSS file scoped to
 * `:root[data-theme="<id>"]` that sets the design tokens used by styles.css, plus
 * any decoration of its own. Add a theme by adding a CSS file and an entry here;
 * the host will be able to pick between them.
 */
export interface Theme {
  id: string;
  name: string;
  /** Google Fonts stylesheet with the theme's typefaces. */
  fontsHref: string;
  /** Browser UI colour on phones. */
  themeColor: string;
}

export const THEMES: Theme[] = [
  {
    id: 'cartoon',
    name: 'Saturday cartoon',
    fontsHref: 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Bowlby+One&display=swap',
    themeColor: '#59c3ff',
  },
];

export const DEFAULT_THEME = THEMES[0].id;

export function themeById(id: string) {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** Switch the page to a theme: tokens, fonts and the phone's browser colour. */
export function applyTheme(id: string) {
  const theme = themeById(id);
  document.documentElement.dataset.theme = theme.id;
  const fonts = document.getElementById('theme-fonts') as HTMLLinkElement | null;
  if (fonts && fonts.href !== theme.fontsHref) fonts.href = theme.fontsHref;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.themeColor);
}
