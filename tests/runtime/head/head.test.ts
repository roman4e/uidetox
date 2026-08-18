import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { head, syncDocumentLang, resetHead } from '../../../src/runtime/head/head.js';
import { setCleanupSink } from '../../../src/runtime/lifecycle.js';
import { flushSync } from '../../../src/runtime/scheduler.js';
import { setLocale, i18n } from '../../../src/i18n/locale.js';
import { registerMessages, clearMessages, t } from '../../../src/i18n/catalog.js';

let sink: Array<() => void>;

beforeEach(() => {
  sink = [];
  setCleanupSink(sink);           // capture head()'s onCleanup registration
  resetHead();
  document.title = 'base';
  document.documentElement.setAttribute('lang', 'xx');
  document.head.querySelectorAll('meta[data-uid-head]').forEach((m) => m.remove());
});

afterEach(() => {
  for (const fn of sink) fn();
  setCleanupSink(null);
});

const meta = (key: string): string | null =>
  document.head.querySelector(`meta[data-uid-head="${key}"]`)?.getAttribute('content') ?? null;

describe('head()', () => {
  it('sets title, lang, and meta tags', () => {
    head({
      title: 'Home',
      lang: 'uk',
      meta: [
        { name: 'description', content: 'desc' },
        { property: 'og:title', content: 'OG' },
      ],
    });
    expect(document.title).toBe('Home');
    expect(document.documentElement.getAttribute('lang')).toBe('uk');
    expect(meta('name:description')).toBe('desc');
    expect(meta('property:og:title')).toBe('OG');
  });

  it('last mounted entry wins, reverts to previous on dispose', () => {
    head({ title: 'A' });
    const stopB = head({ title: 'B' });
    expect(document.title).toBe('B');
    stopB();
    expect(document.title).toBe('A');
  });

  it('reverts to the captured baseline when all entries unmount', () => {
    const stop = head({ title: 'X', lang: 'de' });
    expect(document.title).toBe('X');
    stop();
    expect(document.title).toBe('base');
    expect(document.documentElement.getAttribute('lang')).toBe('xx');
  });

  it('removes stale meta tags on update', () => {
    const stop = head({ meta: [{ name: 'keywords', content: 'a,b' }] });
    expect(meta('name:keywords')).toBe('a,b');
    stop();
    expect(meta('name:keywords')).toBeNull();
  });

  it('re-applies reactively when a title reads t()', () => {
    clearMessages();
    registerMessages('en', { home: { heroTitle: 'Build APIs faster' } });
    registerMessages('uk', { home: { heroTitle: 'Будуйте API швидше' } });
    setLocale('uk-UA');
    head({ title: () => t('home.heroTitle') });
    expect(document.title).toBe('Будуйте API швидше');
    setLocale('en');
    flushSync();
    expect(document.title).toBe('Build APIs faster');
  });
});

describe('syncDocumentLang()', () => {
  it('mirrors the locale onto <html lang> reactively', () => {
    setLocale('uk-UA');
    const stop = syncDocumentLang(() => i18n.locale);
    expect(document.documentElement.getAttribute('lang')).toBe('uk-UA');
    setLocale('pl');
    flushSync();
    expect(document.documentElement.getAttribute('lang')).toBe('pl');
    stop();
  });
});
