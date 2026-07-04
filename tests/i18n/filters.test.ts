import { describe, expect, it, beforeEach } from 'vitest';
import { registerI18nFilters } from '../../src/i18n/filters.js';
import { getFilter } from '../../src/runtime/filters/define.js';
import { setLocale } from '../../src/i18n/locale.js';
import { registerUnit, clearUnits } from '../../src/i18n/units.js';

beforeEach(() => {
  setLocale('uk-UA');
  clearUnits();
  registerUnit('g', { symbol: 'г', base: 1, dimension: 'mass' });
  registerUnit('mg', { symbol: 'мг', base: 1e-3, dimension: 'mass' });
});

const norm = (s: string): string => s.replace(/\s+/g, ' ');

describe('registerI18nFilters', () => {
  it('registers all formatting filters', () => {
    registerI18nFilters();
    for (const name of ['number', 'percent', 'delta', 'qty', 'date', 'dateTime', 'relative']) {
      expect(getFilter(name), name).toBeDefined();
    }
  });

  it('percent filter transforms a value', () => {
    const percent = registerI18nFiltersAndGet('percent');
    expect(norm(percent(0.82) as string)).toBe('82 %');
  });

  it('qty filter reads the unit from params', () => {
    const qty = registerI18nFiltersAndGet('qty');
    expect(norm(qty(1234.5, { unit: 'mg' }) as string)).toBe('1 234,5 мг');
  });
});

// Helper: register then rebuild the callable via the registered descriptor's chain.
import { defineFilter } from '../../src/runtime/filters/define.js';
function registerI18nFiltersAndGet(name: string): (v: unknown, p?: Record<string, unknown>) => unknown {
  registerI18nFilters();
  const desc = getFilter(name)!;
  // Re-wrap the descriptor into a callable (same as defineFilter's return).
  return defineFilter(desc.name, desc);
}
