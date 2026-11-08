import { describe, expect, it } from 'vitest';
import {
  STORAGE_KEY,
  THEME_KEY,
  defaultSettings,
  loadSettings,
  loadTheme,
  normalizeLabel,
  parseDomains,
  parseTerms,
  saveSettings,
  saveTheme,
} from './settings';

function memoryStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    store,
  };
}

describe('parseTerms', () => {
  it('parses LABEL: value lines', () => {
    expect(parseTerms('Company: PT Maju Jaya\nclient name : Globex\n\n# note\nAcme Corp\nURL: https://x.io')).toEqual([
      { label: 'COMPANY', value: 'PT Maju Jaya' },
      { label: 'CLIENT_NAME', value: 'Globex' },
      { label: 'CUSTOM', value: 'Acme Corp' },
      { label: 'URL', value: 'https://x.io' },
    ]);
  });

  it('skips entries without a value', () => {
    expect(parseTerms('COMPANY:\n:\n  ')).toEqual([{ label: 'CUSTOM', value: ':' }]);
  });
});

describe('normalizeLabel', () => {
  it('produces safe placeholder labels', () => {
    expect(normalizeLabel(' client-name!! ')).toBe('CLIENT_NAME');
    expect(normalizeLabel('***')).toBe('CUSTOM');
    expect(normalizeLabel('x'.repeat(50))).toHaveLength(32);
  });
});

describe('parseDomains', () => {
  it('normalizes pasted domains, URLs and wildcards', () => {
    expect(
      parseDomains(' Maju.co.id \n\n# skip\nhttps://user@api.globex.com:8443/path?q=1\n*.initech.io\n.acme.com.'),
    ).toEqual(['maju.co.id', 'api.globex.com', 'initech.io', 'acme.com']);
  });

  it('drops entries that are not domains', () => {
    expect(parseDomains('localhost\nnot a domain\n(.*)\n-bad-.com')).toEqual([]);
  });
});

describe('theme', () => {
  it('round-trips a valid theme and ignores anything else', () => {
    const storage = memoryStorage();
    expect(loadTheme(storage)).toBeUndefined();
    saveTheme(storage, 'dark');
    expect(loadTheme(storage)).toBe('dark');
    storage.setItem(THEME_KEY, 'neon');
    expect(loadTheme(storage)).toBeUndefined();
    expect(loadTheme(undefined)).toBeUndefined();
  });
});

describe('storage', () => {
  it('round-trips settings', () => {
    const storage = memoryStorage();
    const settings = { ...defaultSettings(), terms: 'COMPANY: Acme' };
    expect(saveSettings(storage, settings)).toBe(true);
    expect(loadSettings(storage)).toEqual(settings);
  });

  it('falls back to defaults on corrupt or hostile data', () => {
    expect(loadSettings(memoryStorage({ [STORAGE_KEY]: '{not json' }))).toEqual(defaultSettings());
    expect(loadSettings(memoryStorage({ [STORAGE_KEY]: '42' }))).toEqual(defaultSettings());
    const hostile = loadSettings(
      memoryStorage({ [STORAGE_KEY]: '{"terms":["x"],"enabled":{"ip":"no","email":false,"__proto__":{"x":1}}}' }),
    );
    expect(hostile.terms).toBe('');
    expect(hostile.enabled.ip).toBe(true);
    expect(hostile.enabled.email).toBe(false);
    expect(Object.keys(hostile.enabled)).not.toContain('__proto__');
  });

  it('survives missing or throwing storage', () => {
    expect(loadSettings(undefined)).toEqual(defaultSettings());
    expect(saveSettings(undefined, defaultSettings())).toBe(false);
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(loadSettings(throwing)).toEqual(defaultSettings());
    expect(saveSettings(throwing, defaultSettings())).toBe(false);
  });
});
