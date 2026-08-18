# Done — completed requests

## REQ-07-01 — i18n message catalogs (`t()` + reactive locale) — 2026-08-18

**Priority:** P0 (blocked the whole ApiKraft port). **Status:** ✅ done.

Added a message-catalog layer to `ui-detox/i18n` on top of the existing
formatting-only module.

**What shipped**

- **Reactive locale signal** (`src/i18n/locale.ts`) — `i18n = state({ locale, rev })`.
  `getLocale`/`setLocale` operate on it, so `t()` **and** `fmt.*` share one locale
  and every `${t(...)}` / `${fmt.*}` binding re-renders on `setLocale()` /
  `i18n.locale = …`.
- **`registerMessages(locale, json)`** — nested per-locale maps (merged); bumps
  `i18n.rev` so late-loaded catalogs re-run bindings that had echoed the key.
- **`t(key, params?)`** (`src/i18n/catalog.ts`) — nested dotted-key lookup,
  `{{var}}` interpolation (unknown placeholders left intact), raw array/object
  return (`returnObjects`), missing-key fallback to `setFallbackLocale(...)` then
  the key. Primary-subtag fallback (`uk-UA` → catalog `uk`).
- **`t` filter** (`src/i18n/filters.ts`) — `${'home.heroTitle' | t}`,
  `${'greeting' | t:{name}}`.
- **Back-compat** — legacy `setCatalog(flat)` still works and takes precedence.
- Exports: `registerMessages`, `setFallbackLocale`, `clearMessages`, `i18n` added
  to `ui-detox/i18n`.

**Out of scope (per req):** `<Trans>`-style component, rich/DOM interpolation.

**Verification:** `tests/i18n/catalog.test.ts` (12) + `t`-filter cases in
`filters.test.ts`. Full suite **581 passed**, `tsc` build clean. Docs updated in
`docs/patterns/i18n.md`.

## REQ-07-02 — document head / SEO (per-route) — 2026-08-18

**Priority:** P1. **Status:** ✅ done.

Added a lifecycle-bound document-head manager (`src/runtime/head/`).

- **`head(config)`** — declare `title` / `lang` / `meta` during component boot;
  react-helmet-async semantics (last mounted entry wins, reverts to previous /
  baseline on unmount). Values may be functions → reactive, re-apply on locale
  change (reads `t()`). Managed `<meta>` tags tagged `data-uid-head`, stale ones
  reconciled away.
- **`syncDocumentLang(getLocale)`** — mirror the active locale onto `<html lang>`
  reactively at the app root.
- No-op under SSR (`document` absent). SSR head emission left for later (client
  reactive head was the MVP need).
- Exports: `head`, `syncDocumentLang`, `resetHead`, `HeadConfig`, `MetaTag`.

**Verification:** `tests/runtime/head/head.test.ts` (6). Docs:
`docs/patterns/document-head.md`.

## REQ-07-03 — mount / route-transition animations — 2026-08-18

**Priority:** P2. **Status:** ✅ done.

Enter/exit primitives on top of the existing `animate()` (`src/runtime/anim/enter.ts`).

- **`enter(el, opts)`** — fade+slide enter-on-mount (framer `initial/animate`).
- **`stagger(els, opts, step)`** — per-item delay for `<for>` children.
- **`exit(el, opts)`** — reverse; returns a promise to await before removal.
- **`presence(outgoing, swap, opts)`** — `AnimatePresence mode="wait"` (exit →
  swap → enter).
- **Router:** opt-in `<router-outlet transition>` runs exit-before-enter; default
  swap unchanged.
- All primitives fall back to instant final-state apply under reduced motion / no
  WAAPI.
- Exports: `enter`, `exit`, `stagger`, `presence`, `EnterOptions`.

**Verification:** `tests/runtime/anim/enter.test.ts` (5) + outlet transition test.
Full suite **593 passed**, `tsc` build clean. Docs: `docs/patterns/animations.md`.
