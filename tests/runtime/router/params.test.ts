import { describe, expect, it } from 'vitest';
import { applyParams, coerceParam } from '../../../src/runtime/router/params.js';

describe('coerceParam()', () => {
  it('coerces number and rejects NaN', () => {
    expect(coerceParam('42', { type: 'number', optional: false })).toEqual({ ok: true, value: 42 });
    expect(coerceParam('abc', { type: 'number', optional: false })).toEqual({ ok: false });
  });

  it('coerces int and rejects fractional', () => {
    expect(coerceParam('7', { type: 'int', optional: false })).toEqual({ ok: true, value: 7 });
    expect(coerceParam('7.5', { type: 'int', optional: false })).toEqual({ ok: false });
  });

  it('coerces boolean strictly', () => {
    expect(coerceParam('true', { type: 'boolean', optional: false })).toEqual({ ok: true, value: true });
    expect(coerceParam('false', { type: 'boolean', optional: false })).toEqual({ ok: true, value: false });
    expect(coerceParam('yes', { type: 'boolean', optional: false })).toEqual({ ok: false });
  });

  it('passes string through', () => {
    expect(coerceParam('x', { type: 'string', optional: false })).toEqual({ ok: true, value: 'x' });
  });

  it('runs filter regex', () => {
    expect(coerceParam('7', { type: 'number', optional: false, filter: /^[0-9]+$/ })).toEqual({ ok: true, value: 7 });
    expect(coerceParam('-7', { type: 'number', optional: false, filter: /^[0-9]+$/ })).toEqual({ ok: false });
  });

  it('runs filter function', () => {
    const f = (v: string) => v.length > 2;
    expect(coerceParam('abc', { type: 'string', optional: false, filter: f })).toEqual({ ok: true, value: 'abc' });
    expect(coerceParam('a', { type: 'string', optional: false, filter: f })).toEqual({ ok: false });
  });

  it('optional missing returns default or undefined', () => {
    expect(coerceParam(undefined, { type: 'string', optional: true, default: 'x' })).toEqual({ ok: true, value: 'x' });
    expect(coerceParam(undefined, { type: 'string', optional: true })).toEqual({ ok: true, value: undefined });
    expect(coerceParam(undefined, { type: 'string', optional: false })).toEqual({ ok: false });
  });
});

describe('applyParams()', () => {
  it('reports first failure', () => {
    const result = applyParams({ id: 'x', slug: 'ok' }, {
      id: { type: 'number', optional: false },
      slug: { type: 'string', optional: false },
    });
    expect(result).toEqual({ ok: false, failedOn: 'id' });
  });

  it('returns typed params on success', () => {
    const result = applyParams({ id: '7' }, {
      id: { type: 'number', optional: false },
    });
    expect(result).toEqual({ ok: true, params: { id: 7 } });
  });
});
