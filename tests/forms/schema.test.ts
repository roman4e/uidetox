import { describe, expect, it } from 'vitest';
import { f } from '../../src/forms/schema.js';

function errs(schema: ReturnType<typeof f.string>, value: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  schema.validate(value, '', out);
  return out;
}

describe('schema DSL', () => {
  it('string min/max', () => {
    expect(errs(f.string().min(2), 'a')['']).toBeTruthy();
    expect(errs(f.string().min(2), 'ab')['']).toBeUndefined();
    expect(errs(f.string().max(3), 'abcd')['']).toBeTruthy();
  });

  it('number positive int', () => {
    expect(errs(f.number().positive(), -1 as unknown as string)['']).toBeTruthy();
    expect(errs(f.number().int(), 1.5 as unknown as string)['']).toBeTruthy();
    expect(errs(f.number().min(0).max(1), 0.5 as unknown as string)['']).toBeUndefined();
  });

  it('enum', () => {
    const s = f.enum(['a', 'b']);
    expect(errs(s as never, 'c')['']).toBeTruthy();
    expect(errs(s as never, 'a')['']).toBeUndefined();
  });

  it('optional skips when undefined', () => {
    expect(errs(f.string().min(2).optional(), undefined)['']).toBeUndefined();
    expect(errs(f.string().min(2), undefined)['']).toBeTruthy(); // required
  });

  it('object recurses with dotted path', () => {
    const s = f.object({ name: f.string().min(2), taste: f.object({ salt: f.number().min(0) }) });
    const out: Record<string, string[]> = {};
    s.validate({ name: 'a', taste: { salt: -1 } }, '', out);
    expect(out['name']).toBeTruthy();
    expect(out['taste.salt']).toBeTruthy();
  });

  it('array recurses with indexed path + min length', () => {
    const s = f.array(f.object({ code: f.string().min(1) })).min(1);
    const out: Record<string, string[]> = {};
    s.validate([{ code: '' }], '', out);
    expect(out['0.code']).toBeTruthy();
    const out2: Record<string, string[]> = {};
    s.validate([], '', out2);
    expect(out2['']).toBeTruthy(); // min 1
  });

  it('refine custom message', () => {
    const s = f.string().refine((v) => v === 'ok', 'must be ok');
    expect(errs(s, 'no')['']).toEqual(['must be ok']);
  });
});
