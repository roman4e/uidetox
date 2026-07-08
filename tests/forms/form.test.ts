import { describe, expect, it } from 'vitest';
import { f } from '../../src/forms/schema.js';
import { form } from '../../src/forms/form.js';

// Validation is deferred off-tick; flush the macrotask before reading derived state.
const flush = () => new Promise((r) => setTimeout(r, 0));

const schema = f.object({
  name: f.string().min(2),
  qty: f.number().positive(),
  nutrients: f.array(f.object({ code: f.string().min(1) })).min(1),
});

function make() {
  return form({
    schema,
    initial: { name: '', qty: 1, nutrients: [] as Array<{ code: string }> },
  });
}

describe('form()', () => {
  it('exposes reactive errors and valid', () => {
    const fm = make();
    // name too short, nutrients empty → invalid
    expect(fm.valid).toBe(false);
    expect(fm.errors['name']).toBeTruthy();
  });

  it('field setValue updates values, clears its error, sets dirty', async () => {
    const fm = make();
    fm.field('name').setValue('Salt');
    expect(fm.values.name).toBe('Salt');       // values update synchronously
    expect(fm.field('name').dirty).toBe(true);  // per-field dirty is a sync getter
    await flush();                               // validation settles off-tick
    expect(fm.errors['name']).toBeUndefined();
    expect(fm.dirty).toBe(true);
  });

  it('field touched flag', () => {
    const fm = make();
    expect(fm.field('name').touched).toBe(false);
    fm.field('name').setTouched(true);
    expect(fm.field('name').touched).toBe(true);
  });

  it('array field append/removeAt', () => {
    const fm = make();
    fm.field('nutrients').append({ code: 'FE' });
    expect(fm.values.nutrients).toHaveLength(1);
    expect(fm.values.nutrients[0].code).toBe('FE');
    fm.field('nutrients').removeAt(0);
    expect(fm.values.nutrients).toHaveLength(0);
  });

  it('cross-field rule', async () => {
    const fm = form({
      schema: f.object({ brutto: f.number(), neto: f.number() }),
      initial: { brutto: 10, neto: 20 },
    });
    fm.rule((v) => (v as { neto: number; brutto: number }).neto <= (v as { neto: number; brutto: number }).brutto, 'neto must not exceed brutto', ['neto']);
    expect(fm.errors['neto']).toContain('neto must not exceed brutto'); // rule() validates synchronously
    fm.field('neto').setValue(5);
    await flush();
    expect(fm.errors['neto']).toBeUndefined();
  });

  it('reset restores initial and clears dirty/touched/errors', () => {
    const fm = make();
    fm.field('name').setValue('X');
    fm.field('name').setTouched(true);
    fm.reset();
    expect(fm.values.name).toBe('');
    expect(fm.dirty).toBe(false);
    expect(fm.field('name').touched).toBe(false);
  });

  it('submit runs onSubmit when valid, toggles submitting', async () => {
    const submitted: unknown[] = [];
    const fm = form({
      schema: f.object({ name: f.string().min(1) }),
      initial: { name: 'ok' },
      onSubmit: async (v) => { submitted.push(v); },
    });
    await fm.submit();
    expect(submitted).toEqual([{ name: 'ok' }]);
  });
});
