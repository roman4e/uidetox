import { describe, expect, it, beforeEach } from 'vitest';
import { flushSync } from '../../src/runtime/scheduler.js';
import '../../src/ui/components.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => { document.body.innerHTML = ''; });

function mount(html: string): HTMLElement {
  const holder = document.createElement('div');
  holder.innerHTML = html;
  document.body.appendChild(holder);
  return holder;
}

describe('ui-button', () => {
  it('renders a real <button>, projects the label, reflects variant + disabled', () => {
    const h = mount('<ui-button variant="primary" disabled>Save</ui-button>');
    flushSync();
    const btn = h.querySelector('ui-button > button') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('Save');
    expect(btn.getAttribute('data-variant')).toBe('primary');
    expect(btn.disabled).toBe(true);
  });

  it('loading sets aria-busy and disables', () => {
    const h = mount('<ui-button loading>x</ui-button>');
    flushSync();
    const btn = h.querySelector('button') as HTMLButtonElement;
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(btn.disabled).toBe(true);
  });
});

describe('ui-card named slots', () => {
  it('projects header/default/actions into their blocks', () => {
    const h = mount('<ui-card><span slot="header">H</span><p>Body</p><ui-button slot="actions">Go</ui-button></ui-card>');
    flushSync();
    const card = h.querySelector('ui-card')!;
    expect(card.querySelector('.header')?.textContent).toBe('H');
    expect(card.querySelector('.content')?.textContent).toContain('Body');
    expect(card.querySelector('.actions ui-button')).toBeTruthy();
  });
});

describe('ui-label', () => {
  it('reflects tone', () => {
    const h = mount('<ui-label tone="ok">done</ui-label>');
    flushSync();
    expect(h.querySelector('ui-label span')?.getAttribute('data-tone')).toBe('ok');
  });
});

describe('ui-dropdown', () => {
  it('renders options and emits change with the value', () => {
    const h = mount('<ui-dropdown></ui-dropdown>');
    const dd = h.querySelector('ui-dropdown') as HTMLElement & { options?: unknown };
    (dd as unknown as Record<string, unknown>).options = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];
    flushSync();
    const select = dd.querySelector('select') as HTMLSelectElement;
    expect(select.querySelectorAll('option').length).toBe(2);
    const events: unknown[] = [];
    dd.addEventListener('change', (e) => events.push((e as CustomEvent).detail));
    select.value = 'b';
    select.dispatchEvent(new Event('change'));
    expect(events).toEqual([{ value: 'b' }]);
  });
});

describe('ui-modal', () => {
  it('shows when open and emits close on Escape', async () => {
    const h = mount('<ui-modal open><p slot="header">Title</p><p>Body</p></ui-modal>');
    await tick(); flushSync();
    const modal = h.querySelector('ui-modal')!;
    const backdrop = modal.querySelector('.backdrop') as HTMLElement;
    expect(backdrop.style.display).not.toBe('none');
    expect(modal.querySelector('.dialog[role=dialog][aria-modal=true]')).toBeTruthy();
    const closes: unknown[] = [];
    modal.addEventListener('close', () => closes.push(1));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closes).toHaveLength(1);
    modal.remove();
  });
});

describe('ui-input', () => {
  it('wires label/for and proxies value + relays input (for forms bind=)', () => {
    const h = mount('<ui-input label="Email"></ui-input>');
    flushSync();
    const host = h.querySelector('ui-input') as HTMLElement & { value?: string };
    const input = host.querySelector('input')!;
    const label = host.querySelector('label')!;
    expect(label.textContent).toBe('Email');
    expect(label.getAttribute('for')).toBe(input.id);

    const relayed: unknown[] = [];
    host.addEventListener('input', () => relayed.push(host.value));
    input.value = 'hi';
    input.dispatchEvent(new Event('input'));
    expect(relayed).toEqual(['hi']);        // host.value proxies the inner input

    host.value = 'set';                       // writing the host writes the input
    expect(input.value).toBe('set');
  });
});
