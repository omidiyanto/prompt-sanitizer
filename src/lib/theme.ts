import { loadTheme, type Theme } from './settings';

const BACKGROUNDS: Record<Theme, string> = { light: '#ffffff', dark: '#0a0a0a' };

export function initialTheme(storage: Storage | undefined): Theme {
  return loadTheme(storage) ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BACKGROUNDS[theme]);
}
