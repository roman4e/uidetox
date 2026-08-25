import { describe, expect, it, beforeEach } from 'vitest';
import { effect } from '../../src/runtime/effect.js';
import { flushSync } from '../../src/runtime/scheduler.js';
import { setLocale, i18n } from '../../src/i18n/locale.js';
import { fmt } from '../../src/i18n/format.js';
import {
  t, setCatalog, registerMessages, setFallbackLocale, clearMessages,
} from '../../src/i18n/catalog.js';

const en = {
  home: {
    heroTitle: 'Build APIs faster',
    webDevFeatures: ['Design', 'Mock', 'Ship'],
  },
  greeting: 'Hello, {{name}}',
};
const uk = {
  home: {
    heroTitle: 'Будуйте API швидше',
    webDevFeatures: ['Дизайн', 'Мок', 'Реліз'],
  },
  greeting: 'Привіт, {{name}}',
};

beforeEach(() => {
  clearMessages();
  setLocale('uk-UA');
  registerMessages('en', en);
  registerMessages('uk', uk);
});

describe('t() message catalog', () => {
  it('resolves nested dotted keys in the active locale', () => {
    expect(t('home.heroTitle')).toBe('Будуйте API швидше');
    setLocale('en');
    expect(t('home.heroTitle')).toBe('Build APIs faster');
  });

  it('falls back to the primary subtag (uk-UA → uk)', () => {
    setLocale('uk-UA');
    expect(t('home.heroTitle')).toBe('Будуйте API швидше');
  });

  it('interpolates {{var}} from params', () => {
    expect(t('greeting', { name: 'Роман' })).toBe('Привіт, Роман');
  });

  it('leaves unknown placeholders intact', () => {
    expect(t('greeting')).toBe('Привіт, {{name}}');
  });

  it('returns raw arrays/objects (returnObjects)', () => {
    expect(t('home.webDevFeatures')).toEqual(['Дизайн', 'Мок', 'Реліз']);
    setLocale('en');
    expect(t<string[]>('home.webDevFeatures')).toEqual(['Design', 'Mock', 'Ship']);
  });

  it('echoes the key when missing and no fallback', () => {
    expect(t('nope.missing')).toBe('nope.missing');
    expect(t('home.deeper.missing')).toBe('home.deeper.missing');
  });

  it('uses the configured fallback locale for missing keys', () => {
    registerMessages('de', { home: {} });
    setLocale('de');
    setFallbackLocale('en');
    expect(t('home.heroTitle')).toBe('Build APIs faster');
    setFallbackLocale(null);
    expect(t('home.heroTitle')).toBe('home.heroTitle');
  });
});

describe('t() reactivity', () => {
  it('re-runs bindings on setLocale()', () => {
    const seen: string[] = [];
    const stop = effect(() => { seen.push(t('home.heroTitle')); });
    expect(seen).toEqual(['Будуйте API швидше']);
    setLocale('en');
    flushSync();
    expect(seen).toEqual(['Будуйте API швидше', 'Build APIs faster']);
    stop();
  });

  it('re-runs a missed lookup once registerMessages loads strings', () => {
    clearMessages();
    setLocale('en');
    const seen: string[] = [];
    const stop = effect(() => { seen.push(t('late.key')); });
    expect(seen).toEqual(['late.key']); // key echoed, catalog empty
    registerMessages('en', { late: { key: 'Loaded' } });
    flushSync();
    expect(seen).toEqual(['late.key', 'Loaded']);
    stop();
  });

  it('t() and fmt.* share the same reactive locale', () => {
    const seen: string[] = [];
    const stop = effect(() => { seen.push(`${t('home.heroTitle')}|${fmt.number(1.5)}`); });
    expect(seen[0]).toContain('Будуйте'); // uk-UA: comma decimal via fmt
    setLocale('en');
    flushSync();
    expect(seen[1]).toContain('Build APIs faster');
    stop();
  });
});

describe('setCatalog back-compat', () => {
  it('returns the key when the flat override is null', () => {
    setCatalog(null);
    setLocale('en');
    expect(t('recipe.emptyGraph')).toBe('recipe.emptyGraph');
  });

  it('flat override wins over nested catalogs', () => {
    setCatalog({ 'recipe.emptyGraph': 'Порожній граф' });
    expect(t('recipe.emptyGraph')).toBe('Порожній граф');
    setCatalog(null);
  });
});
