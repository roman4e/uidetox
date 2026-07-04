# REQ-06 — Minimal i18n (formatting only for MVP)

**Requested by:** Culinary frontend
**Priority:** P2 (Culinary MVP ships in Ukrainian only; hard-coded strings are fine)
**Estimated effort:** small (2-3 days)

## Purpose

Even single-locale apps need locale-aware **number / date / unit formatting**. Ingredient masses, nutrient amounts, dates on version history — all must render with Ukrainian conventions (space thousands separator, comma decimal, "г" / "мг" / "мкг" / "ккал" units). Free-text translation is out of scope for MVP; **only formatting is requested here**.

## Motivating use cases from Culinary

1. **Nutrient tables** — `1234.5 mg` → `1 234,5 мг`.
2. **Kcal on recipe card** — `2450` → `2 450 ккал`.
3. **Version created_at** — ISO timestamp → `26 черв. 2026, 14:32`.
4. **Percentages** (retention, yield) — `0.82` → `82 %`.
5. **Signed deltas** — `+12.3` / `-4.5` with sign and colour (colour is CSS, formatter provides sign).

## Proposed API

### Locale + unit registry

```ts
import { setLocale, registerUnit } from 'uidetox/i18n';

setLocale('uk-UA');

registerUnit('g',   { symbol: 'г',   base: 1 });
registerUnit('mg',  { symbol: 'мг',  base: 1e-3, convertFrom: { g: 1000 } });
registerUnit('mcg', { symbol: 'мкг', base: 1e-6, convertFrom: { g: 1e6, mg: 1000 } });
registerUnit('kcal',{ symbol: 'ккал', base: 1 });
registerUnit('kj',  { symbol: 'кДж', base: 1, convertFrom: { kcal: 4.184 } });
```

### Formatting API

```ts
import { fmt } from 'uidetox/i18n';

fmt.number(1234.5)                     // "1 234,5"
fmt.number(1234.5, { decimals: 0 })    // "1 235"
fmt.percent(0.82)                      // "82 %"
fmt.percent(0.821, { decimals: 1 })    // "82,1 %"
fmt.delta(12.3)                        // "+12,3"
fmt.delta(-4.5, { decimals: 1 })       // "-4,5"
fmt.qty(1234.5, 'mg')                  // "1 234,5 мг"
fmt.qty(1234.5, 'mg', { to: 'g' })     // "1,2 г"   (auto-scale)
fmt.qty(1234.5, 'mg', { auto: true })  // choose best unit by magnitude
fmt.date(iso)                          // "26 черв. 2026"
fmt.dateTime(iso)                      // "26 черв. 2026, 14:32"
fmt.relative(iso)                      // "2 години тому"
```

Implementation on top of `Intl.NumberFormat`, `Intl.DateTimeFormat`, `Intl.RelativeTimeFormat` — no bundle bloat.

### Template usage

Direct call inside interpolation is fine:

```html
<td>${fmt.qty(node.mass_neto_g, 'g')}</td>
<td>${fmt.qty(nutrient.amount, 'mg', { auto: true })}</td>
```

Optional filter sugar (UIDetox already has `filters/` module):

```html
<td>${node.mass_neto_g | qty:'g'}</td>
<td>${nutrient.amount | qty:'mg':{auto: true}}</td>
```

Filter is nicer; if `filters` DSL already supports args, register `qty`, `number`, `percent`, `delta`, `date`, `dateTime`, `relative`.

### String catalog — deferred stub

Even though translation is out of scope, expose a stub so consumer code paths don't rewrite when a second locale arrives:

```ts
import { t } from 'uidetox/i18n';
t('recipe.emptyGraph')       // returns key as-is if no catalog registered
```

Consumer must not use `t()` in MVP (Culinary uses inline literals), but the function exists.

## Acceptance criteria

- [ ] `setLocale`, `fmt.number`, `fmt.percent`, `fmt.qty`, `fmt.date`, `fmt.dateTime`, `fmt.relative`, `fmt.delta` implemented and tested with `uk-UA`.
- [ ] `registerUnit` + unit conversion.
- [ ] Auto-scale (`{ auto: true }`) chooses among registered units by magnitude (rule: use unit where value is in [0.5, 999]).
- [ ] Filter registrations: `qty`, `number`, `percent`, `delta`, `date`, `dateTime`, `relative`.
- [ ] `t(key)` stub returns key when catalog absent.
- [ ] Docs page listing available formatters + examples.

## Out of scope for MVP

- Multi-locale runtime switching.
- Message catalogs (ICU, gettext, or key-value JSON).
- Pluralization rules beyond what `Intl.PluralRules` provides for future work.
- RTL support.

## Open questions

1. Filter syntax with args — does UIDetox's current filter DSL already accept multiple args and object literals, or should we register per-unit filters (`qty-g`, `qty-mg`)? Please clarify from your side.
