import { CATEGORIES, type Category } from './rules';
import type { SanitizeOptions, Term } from './sanitize';

export type Theme = 'light' | 'dark';

export interface Settings {
  terms: string;
  domains: string;
  enabled: Record<Category, boolean>;
}

export const STORAGE_KEY = 'prompt-sanitizer:settings:v1';
export const THEME_KEY = 'prompt-sanitizer:theme';

const MAX_LABEL_LENGTH = 32;

export function defaultSettings(): Settings {
  return {
    terms: '',
    domains: '',
    enabled: Object.fromEntries(CATEGORIES.map(({ id }) => [id, true])) as Record<Category, boolean>,
  };
}

export function normalizeLabel(raw: string): string {
  const label = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, MAX_LABEL_LENGTH);
  return label || 'CUSTOM';
}

function lines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

export function parseTerms(raw: string): Term[] {
  return lines(raw).flatMap((line) => {
    const separator = line.indexOf(':');
    const label = separator > 0 ? normalizeLabel(line.slice(0, separator)) : 'CUSTOM';
    const value = (separator > 0 ? line.slice(separator + 1) : line).trim();
    return value ? [{ label, value }] : [];
  });
}

export function parseDomains(raw: string): string[] {
  return lines(raw).flatMap((line) => {
    const domain = line
      .toLowerCase()
      .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
      .replace(/^[^@/]*@/, '')
      .replace(/[/?#].*$/, '')
      .replace(/:\d+$/, '')
      .replace(/^(?:\*\.|\.)+/, '')
      .replace(/\.$/, '');
    return /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9-]{2,}$/.test(domain) ? [domain] : [];
  });
}

export function toOptions(settings: Settings): SanitizeOptions {
  return {
    terms: parseTerms(settings.terms),
    domains: parseDomains(settings.domains),
    enabled: settings.enabled,
  };
}

function coerce(value: unknown): Settings {
  const fallback = defaultSettings();
  if (!value || typeof value !== 'object') return fallback;
  const stored = value as Partial<Record<keyof Settings, unknown>>;
  const enabled = (stored.enabled && typeof stored.enabled === 'object' ? stored.enabled : {}) as Record<string, unknown>;
  return {
    terms: typeof stored.terms === 'string' ? stored.terms : fallback.terms,
    domains: typeof stored.domains === 'string' ? stored.domains : fallback.domains,
    enabled: Object.fromEntries(
      CATEGORIES.map(({ id }) => [id, typeof enabled[id] === 'boolean' ? enabled[id] : true]),
    ) as Record<Category, boolean>,
  };
}

export function loadSettings(storage: Pick<Storage, 'getItem'> | undefined): Settings {
  try {
    return coerce(JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null'));
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(storage: Pick<Storage, 'setItem'> | undefined, settings: Settings): boolean {
  try {
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export function loadTheme(storage: Pick<Storage, 'getItem'> | undefined): Theme | undefined {
  try {
    const theme = storage?.getItem(THEME_KEY);
    return theme === 'light' || theme === 'dark' ? theme : undefined;
  } catch {
    return undefined;
  }
}

export function saveTheme(storage: Pick<Storage, 'setItem'> | undefined, theme: Theme): void {
  try {
    storage?.setItem(THEME_KEY, theme);
  } catch {
    return;
  }
}

export function browserStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}
