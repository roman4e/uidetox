import { describe, expect, it, beforeEach } from 'vitest';
import { setLocale } from '../../src/i18n/locale.js';
import { registerUnit, clearUnits, convert, bestUnit } from '../../src/i18n/units.js';
import { fmt } from '../../src/i18n/format.js';
import { t, setCatalog } from '../../src/i18n/catalog.js';

// Normalize locale whitespace (NBSP / narrow NBSP) to a plain space for stable assertions.
const norm = (s: string): string => s.replace(/[  ]/g, ' ');

beforeEach(() => {
  setLocale('uk-UA');
  clearUnits();
  registerUnit('g', { symbol: 'г', base: 1, dimension: 'mass' });
  registerUnit('mg', { symbol: 'мг', base: 1e-3, dimension: 'mass' });
  registerUnit('mcg', { symbol: 'мкг', base: 1e-6, dimension: 'mass' });
  registerUnit('kcal', { symbol: 'ккал', base: 1, dimension: 'energy' });
});

describe('fmt (uk-UA)', () => {
  it('formats numbers with grouped thousands and comma decimal', () => {
    expect(norm(fmt.number(1234.5))).toBe('1 234,5');
    expect(norm(fmt.number(1234.5, { decimals: 0 }))).toBe('1 235');
  });

  it('formats percent', () => {
    expect(norm(fmt.percent(0.82))).toBe('82 %');
    expect(norm(fmt.percent(0.821, { decimals: 1 }))).toBe('82,1 %');
  });

  it('formats signed deltas', () => {
    expect(norm(fmt.delta(12.3))).toBe('+12,3');
    expect(norm(fmt.delta(-4.5, { decimals: 1 }))).toBe('-4,5');
  });

  it('formats quantities with unit symbols', () => {
    expect(norm(fmt.qty(1234.5, 'mg'))).toBe('1 234,5 мг');
  });

  it('converts quantities with { to }', () => {
    expect(norm(fmt.qty(1234.5, 'mg', { to: 'g' }))).toBe('1,2 г');
  });

  it('auto-scales quantities by magnitude', () => {
    expect(norm(fmt.qty(1234.5, 'mg', { auto: true }))).toBe('1,2 г');
    expect(norm(fmt.qty(0.3, 'mg', { auto: true }))).toBe('300 мкг');
  });

  it('formats dates and date-times', () => {
    const iso = '2026-06-26T14:32:00Z';
    // exact month abbreviation is ICU-dependent; assert the numeric parts + year
    expect(fmt.date(iso)).toContain('2026');
    expect(norm(fmt.dateTime(iso))).toMatch(/2026.*\d{2}:\d{2}/);
  });

  it('formats relative time', () => {
    const now = Date.parse('2026-06-26T16:00:00Z');
    const twoHoursAgo = '2026-06-26T14:00:00Z';
    expect(fmt.relative(twoHoursAgo, now)).toBeTruthy();
  });
});

describe('units', () => {
  it('converts via base ratio', () => {
    expect(convert(1000, 'mg', 'g')).toBeCloseTo(1);
    expect(convert(1, 'g', 'mcg')).toBeCloseTo(1e6);
  });

  it('bestUnit picks the readable unit', () => {
    expect(bestUnit(1234.5, 'mg')).toBe('g');
    expect(bestUnit(0.3, 'mg')).toBe('mcg');
    expect(bestUnit(5, 'g')).toBe('g');
  });
});

describe('t() stub', () => {
  it('returns the key when no catalog is set', () => {
    setCatalog(null);
    expect(t('recipe.emptyGraph')).toBe('recipe.emptyGraph');
  });
  it('returns a translation when a catalog is set', () => {
    setCatalog({ 'recipe.emptyGraph': 'Порожній граф' });
    expect(t('recipe.emptyGraph')).toBe('Порожній граф');
    setCatalog(null);
  });
});
