import { effect } from '../effect.js';
import { onCleanup } from '../lifecycle.js';

// Document-head manager with react-helmet-async semantics: multiple components
// may declare head fields; the last mounted entry that defines a field wins, and
// unmounting reverts to the previous winner. Values may be functions so they can
// read reactive sources (e.g. `t()`), making the head re-apply on locale change.

export interface MetaTag {
  /** `<meta name="…">` (description, keywords, twitter:*). */
  name?: string;
  /** `<meta property="…">` (og:*). */
  property?: string;
  content: string;
}

type Resolvable<T> = T | (() => T);

export interface HeadConfig {
  title?: Resolvable<string>;
  /** Sets `<html lang>`. */
  lang?: Resolvable<string>;
  meta?: Resolvable<MetaTag[]>;
}

interface Snapshot {
  title?: string;
  lang?: string;
  meta: MetaTag[];
}

const MANAGED = 'data-uid-head';
const entries: Snapshot[] = [];

// Baseline captured on first apply so the head reverts cleanly when every entry
// that set a field has unmounted.
let baseTitle: string | null = null;
let baseLang: string | null = null;

function resolve<T>(v: Resolvable<T> | undefined): T | undefined {
  return typeof v === 'function' ? (v as () => T)() : v;
}

function metaKey(m: MetaTag): string {
  return m.property ? `property:${m.property}` : `name:${m.name ?? ''}`;
}

function applyAll(): void {
  const doc = typeof document !== 'undefined' ? document : undefined;
  if (!doc) return;
  if (baseTitle === null) baseTitle = doc.title;
  if (baseLang === null) baseLang = doc.documentElement.getAttribute('lang') ?? '';

  // Last-write-wins for scalars.
  let title: string | undefined;
  let lang: string | undefined;
  const meta = new Map<string, MetaTag>();
  for (const e of entries) {
    if (e.title !== undefined) title = e.title;
    if (e.lang !== undefined) lang = e.lang;
    for (const m of e.meta) meta.set(metaKey(m), m);
  }

  doc.title = title ?? baseTitle;
  doc.documentElement.setAttribute('lang', lang ?? baseLang);

  // Reconcile managed <meta> tags: upsert wanted, drop stale.
  const head = doc.head;
  const existing = new Map<string, HTMLMetaElement>();
  for (const el of Array.from(head.querySelectorAll<HTMLMetaElement>(`meta[${MANAGED}]`))) {
    existing.set(el.getAttribute(MANAGED) ?? '', el);
  }
  for (const [key, m] of meta) {
    let el = existing.get(key);
    if (!el) {
      el = doc.createElement('meta');
      el.setAttribute(MANAGED, key);
      if (m.property) el.setAttribute('property', m.property);
      else if (m.name) el.setAttribute('name', m.name);
      head.appendChild(el);
    }
    el.setAttribute('content', m.content);
    existing.delete(key);
  }
  for (const el of existing.values()) el.remove();
}

/**
 * Declare document-head fields for the current component. Call during boot;
 * reverts on unmount. Reactive: if any value is a function reading `t()` /
 * `i18n.locale`, the head re-applies on change.
 * Returns a disposer (also auto-registered via `onCleanup`).
 */
export function head(config: HeadConfig): () => void {
  const entry: Snapshot = { meta: [] };
  entries.push(entry);

  const stopEffect = effect(() => {
    entry.title = resolve(config.title);
    entry.lang = resolve(config.lang);
    entry.meta = resolve(config.meta) ?? [];
    applyAll();
  });

  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    stopEffect();
    const i = entries.indexOf(entry);
    if (i !== -1) entries.splice(i, 1);
    applyAll();
  };
  onCleanup(dispose);
  return dispose;
}

/**
 * Reactively mirror a locale getter onto `<html lang>`. Use at the app root:
 * `syncDocumentLang(getLocale)`. Returns a disposer.
 */
export function syncDocumentLang(get: () => string): () => void {
  return effect(() => {
    const lang = get();
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', lang);
    }
  });
}

/** Test/reset helper: drop all entries and restore the captured baseline. */
export function resetHead(): void {
  entries.length = 0;
  baseTitle = null;
  baseLang = null;
}
