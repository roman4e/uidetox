import { describe, expect, it } from 'vitest';
import { f } from '../../src/forms/schema.js';
import { form } from '../../src/forms/form.js';
import { registerFormComponents } from '../../src/forms/components.js';
import { __bindField } from '../../src/runtime/domHelpers.js';
import { flushSync } from '../../src/runtime/scheduler.js';

registerFormComponents();

function make() {
  return form({
    schema: f.object({ name: f.string().min(2), agree: f.boolean() }),
    initial: { name: '', agree: false },
  });
}

describe('__bindField', () => {
  it('reflects field.value into a text input', () => {
    const fm = make();
    fm.field('name').setValue('Salt');
    const input = document.createElement('input');
    __bindField(input, fm.field('name'));
    expect(input.value).toBe('Salt');
  });

  it('input event writes back to the field', () => {
    const fm = make();
    const input = document.createElement('input');
    __bindField(input, fm.field('name'));
    input.value = 'Pepper';
    input.dispatchEvent(new Event('input'));
    expect(fm.values.name).toBe('Pepper');
  });

  it('checkbox reflects and writes boolean', () => {
    const fm = make();
    const box = document.createElement('input');
    box.type = 'checkbox';
    __bindField(box, fm.field('agree'));
    expect(box.checked).toBe(false);
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    expect(fm.values.agree).toBe(true);
  });

  it('blur marks the field touched', () => {
    const fm = make();
    const input = document.createElement('input');
    __bindField(input, fm.field('name'));
    input.dispatchEvent(new Event('blur'));
    expect(fm.field('name').touched).toBe(true);
  });

  it('reflects later field updates reactively', () => {
    const fm = make();
    const input = document.createElement('input');
    __bindField(input, fm.field('name'));
    fm.field('name').setValue('Sugar');
    flushSync();
    expect(input.value).toBe('Sugar');
  });
});

describe('<field-error>', () => {
  it('renders the first error and clears when fixed', () => {
    const fm = make();
    const el = document.createElement('field-error') as HTMLElement & { of: unknown };
    el.of = fm.field('name');
    document.body.appendChild(el);
    expect(el.textContent).toBeTruthy();
    fm.field('name').setValue('Ok');
    flushSync();
    expect(el.textContent).toBe('');
    el.remove();
  });
});
