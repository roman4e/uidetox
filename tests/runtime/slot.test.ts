import { describe, expect, it } from 'vitest';
import { defineComponent } from '../../src/runtime/component.js';
import { __el, __text } from '../../src/runtime/domHelpers.js';

describe('light-DOM <slot> projection', () => {
  it('projects pre-existing children into the template slot', () => {
    defineComponent({
      tag: 'shell-a',
      boot: (ctx) => __el('div', [['class', 'static', 'shell']], [
        __el('header', [], [__text('H')], ctx),
        __el('main', [], [__el('slot', [], [], ctx)], ctx),
      ], ctx),
    });
    const el = document.createElement('shell-a');
    const page = document.createElement('p');
    page.textContent = 'page';
    el.appendChild(page);
    document.body.appendChild(el);

    // page is projected where <slot> was (inside <main>), slot removed
    expect(el.querySelector('slot')).toBeNull();
    expect(el.querySelector('main > p')?.textContent).toBe('page');
    el.remove();
  });

  it('appends slotted content when the template has no slot', () => {
    defineComponent({
      tag: 'noslot-a',
      boot: (ctx) => __el('div', [], [__text('x')], ctx),
    });
    const el = document.createElement('noslot-a');
    const c = document.createElement('span');
    c.textContent = 'kept';
    el.appendChild(c);
    document.body.appendChild(el);
    expect(el.textContent).toContain('kept'); // not lost
    el.remove();
  });
});
