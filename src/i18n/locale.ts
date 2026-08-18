import { state } from '../runtime/state.js';

// Single reactive locale signal shared by `t()` and `fmt.*` so they always
// agree on one locale. `rev` is a catalog-generation counter: bumping it re-runs
// reactive `t()` reads when `registerMessages` loads new strings, even though the
// active locale did not change. Reads of these fields inside a `${...}` binding
// (or `effect`) subscribe the binding; writes re-render it.
export const i18n = state({ locale: 'uk-UA', rev: 0 });

export function setLocale(locale: string): void {
  i18n.locale = locale;
}

export function getLocale(): string {
  return i18n.locale;
}
