import { i18n } from './locale.js';

// Message catalogs: one nested map per locale, e.g.
//   catalogs['uk'] = { home: { heroTitle: 'Привіт', webDevFeatures: ['a','b'] } }
// `t()` reads the active `i18n.locale` reactively, so every `${t(...)}` binding
// re-renders on `setLocale()` / `i18n.locale = …`. `registerMessages` bumps
// `i18n.rev` so bindings that missed (echoed the key) re-run once strings load.

type Messages = Record<string, unknown>;

const catalogs: Record<string, Messages> = {};
// Back-compat: `setCatalog(flat)` installs a flat key→string override consulted
// before the nested catalogs (kept for existing call sites and tests).
let flatOverride: Record<string, string> | null = null;
let fallbackLocale: string | null = null;

/** Register (merge) a per-locale nested message map. */
export function registerMessages(locale: string, messages: Messages): void {
  catalogs[locale] = { ...catalogs[locale], ...messages };
  i18n.rev++;
}

/** Locale used when a key is missing from the active locale. `null` disables it. */
export function setFallbackLocale(locale: string | null): void {
  fallbackLocale = locale;
  i18n.rev++;
}

/** Remove all registered catalogs and overrides (test/reset helper). */
export function clearMessages(): void {
  for (const k of Object.keys(catalogs)) delete catalogs[k];
  flatOverride = null;
  fallbackLocale = null;
  i18n.rev++;
}

/** Back-compat flat catalog: `setCatalog({ 'a.b': 'text' })` or `null` to clear. */
export function setCatalog(next: Record<string, string> | null): void {
  flatOverride = next;
  i18n.rev++;
}

// Resolve the catalog for a locale, falling back to its primary subtag so a
// catalog registered as 'uk' answers an active locale of 'uk-UA'.
function catalogFor(locale: string): Messages | undefined {
  return catalogs[locale] ?? catalogs[locale.split('-')[0]];
}

// Walk a dotted path (`home.heroTitle`) through a nested map. Returns undefined
// if any segment is missing or a non-object is traversed.
function lookup(cat: Messages | undefined, key: string): unknown {
  if (!cat) return undefined;
  let node: unknown = cat;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

function interpolate(tpl: string, params?: Record<string, unknown>): string {
  if (!params) return tpl;
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, name: string) =>
    name in params ? String(params[name]) : `{{${name}}}`,
  );
}

/**
 * Translate `key` in the active locale.
 * - Nested dotted keys (`home.heroTitle`).
 * - `{{var}}` interpolation from `params`.
 * - Non-string values (arrays/objects) are returned raw (`returnObjects`),
 *   feeding `<for each=${t('...')}>` directly.
 * - Missing key: try the fallback locale, else echo `key`.
 * Reactive: reads `i18n.locale`/`i18n.rev`, so bindings re-run on locale change
 * or catalog registration.
 */
export function t<T = string>(key: string, params?: Record<string, unknown>): T {
  const locale = i18n.locale;
  void i18n.rev; // subscribe to catalog generation so late `registerMessages` re-runs

  const flat = flatOverride?.[key];
  if (flat !== undefined) return interpolate(flat, params) as T;

  let value = lookup(catalogFor(locale), key);
  if (value === undefined && fallbackLocale) {
    value = lookup(catalogFor(fallbackLocale), key);
  }
  if (value === undefined) return key as T;
  if (typeof value === 'string') return interpolate(value, params) as T;
  return value as T;
}
