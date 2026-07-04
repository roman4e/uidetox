import { describe, expect, it } from 'vitest';
import { f } from '../../src/forms/schema.js';
import { form } from '../../src/forms/form.js';

function make() {
  return form({
    schema: f.object({ name: f.string().min(1), email: f.string().min(1) }),
    initial: { name: 'ok', email: 'a@b.c' },
  });
}

describe('applyServerErrors', () => {
  it('merges server field errors and marks the form invalid', () => {
    const fm = make();
    expect(fm.valid).toBe(true);
    fm.applyServerErrors({ fieldErrors: { email: ['already registered'] } });
    expect(fm.errors['email']).toContain('already registered');
    expect(fm.field('email').error).toBe('already registered');
    expect(fm.valid).toBe(false);
  });

  it('clears a server error when its field is edited', () => {
    const fm = make();
    fm.applyServerErrors({ fieldErrors: { email: ['already registered'] } });
    fm.field('email').setValue('new@x.c');
    expect(fm.errors['email']).toBeUndefined();
    expect(fm.valid).toBe(true);
  });

  it('replaces previous server errors on a subsequent call', () => {
    const fm = make();
    fm.applyServerErrors({ fieldErrors: { name: ['bad'] } });
    fm.applyServerErrors({ fieldErrors: { email: ['worse'] } });
    expect(fm.errors['name']).toBeUndefined();
    expect(fm.errors['email']).toContain('worse');
  });

  it('tolerates a null/empty error', () => {
    const fm = make();
    fm.applyServerErrors(null);
    fm.applyServerErrors({});
    expect(fm.valid).toBe(true);
  });

  it('reset clears server errors', () => {
    const fm = make();
    fm.applyServerErrors({ fieldErrors: { name: ['bad'] } });
    fm.reset();
    expect(fm.errors['name']).toBeUndefined();
    expect(fm.valid).toBe(true);
  });
});
