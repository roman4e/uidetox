import { describe, expect, it, vi } from 'vitest';
import { f } from '../../src/forms/schema.js';
import { form } from '../../src/forms/form.js';
import { flushSync } from '../../src/runtime/scheduler.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('async validators', () => {
  it('sets pending then resolves with an async error', async () => {
    const codeSchema = f.string().min(1);
    codeSchema.asyncCheck(async (v) => (v === 'TAKEN' ? 'already used' : true), { debounceMs: 0 });
    const fm = form({
      schema: f.object({ code: codeSchema }),
      initial: { code: '' },
    });
    fm.field('code').setValue('TAKEN');
    await tick();                                   // deferred validation runs → pending set
    expect(fm.field('code').pending).toBe(true);
    expect(fm.valid).toBe(false);
    await tick();
    await tick();
    expect(fm.field('code').pending).toBe(false);
    expect(fm.errors['code']).toContain('already used');
    expect(fm.valid).toBe(false);
  });

  it('passes async validation when value is free', async () => {
    const codeSchema = f.string().min(1);
    codeSchema.asyncCheck(async (v) => (v === 'TAKEN' ? 'already used' : true), { debounceMs: 0 });
    const fm = form({
      schema: f.object({ code: codeSchema }),
      initial: { code: '' },
    });
    fm.field('code').setValue('FREE');
    await tick();
    await tick();
    expect(fm.field('code').pending).toBe(false);
    expect(fm.errors['code']).toBeUndefined();
    expect(fm.valid).toBe(true);
  });

  it('supersedes a stale async run when value changes quickly', async () => {
    const seen: string[] = [];
    const codeSchema = f.string().min(1);
    codeSchema.asyncCheck(async (v) => { seen.push(v as string); return v === 'A' ? 'bad A' : true; }, { debounceMs: 0 });
    const fm = form({
      schema: f.object({ code: codeSchema }),
      initial: { code: '' },
    });
    fm.field('code').setValue('A');
    fm.field('code').setValue('B');
    await tick();
    await tick();
    // Only the latest value's verdict should apply.
    expect(fm.errors['code']).toBeUndefined();
    expect(fm.valid).toBe(true);
  });

  it('skips async while a sync error stands', async () => {
    const ran = vi.fn(async () => true as const);
    const codeSchema = f.string().min(3);
    codeSchema.asyncCheck(ran, { debounceMs: 0 });
    const fm = form({
      schema: f.object({ code: codeSchema }),
      initial: { code: '' },
    });
    fm.field('code').setValue('ab'); // fails min(3) synchronously
    await tick();
    expect(ran).not.toHaveBeenCalled();
    expect(fm.field('code').pending).toBe(false);
  });
});

describe('watch', () => {
  it('fires the callback on value change and returns a disposer', () => {
    const fm = form({
      schema: f.object({ name: f.string() }),
      initial: { name: 'a' },
    });
    const seen: unknown[] = [];
    const stop = fm.watch('name', (v) => seen.push(v));
    expect(seen).toEqual(['a']); // immediate
    fm.field('name').setValue('b');
    flushSync();
    expect(seen).toEqual(['a', 'b']);
    stop();
    fm.field('name').setValue('c');
    flushSync();
    expect(seen).toEqual(['a', 'b']);
  });
});
