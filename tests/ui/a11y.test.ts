import { describe, expect, it, beforeEach } from 'vitest';
import { flushSync } from '../../src/runtime/scheduler.js';
import { axe } from '../../src/testing/a11y/runtime.js';
import '../../src/ui/components.js';

const tick = () => new Promise((r) => setTimeout(r, 0));
beforeEach(() => { document.body.innerHTML = ''; });

function mount(html: string): void {
  const holder = document.createElement('div');
  holder.innerHTML = html;
  document.body.appendChild(holder); // appendChild fires custom-element reactions synchronously
}

// Rules that need real layout/visibility — unreliable under happy-dom (no layout),
// verified instead by the visual (Playwright) harness. Structure is asserted directly.
const LAYOUT_RULES = new Set(['button-name', 'color-contrast', 'link-name', 'image-alt']);

describe('ui kit a11y', () => {
  it('has the structural a11y contract (real button, label/for, roles/aria)', () => {
    mount(`
      <main>
        <h1>Kit</h1>
        <ui-button variant="primary">Save</ui-button>
        <ui-input label="Title"></ui-input>
        <ui-modal open><p slot="header">T</p><p>b</p></ui-modal>
      </main>`);
    flushSync();

    const btn = document.querySelector('ui-button button') as HTMLButtonElement;
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.textContent).toContain('Save');       // discernible text present

    const input = document.querySelector('ui-input input') as HTMLInputElement;
    const label = document.querySelector('ui-input label') as HTMLLabelElement;
    expect(label.getAttribute('for')).toBe(input.id); // label associated

    const dialog = document.querySelector('ui-modal .dialog')!;
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('is axe-clean for the rules axe can judge without layout', async () => {
    mount(`
      <main>
        <h1>Kit</h1>
        <ui-button variant="primary">Save</ui-button>
        <ui-input label="Title"></ui-input>
        <ui-label tone="ok">done</ui-label>
      </main>`);
    await tick();
    flushSync();
    const result = await axe(document.body);
    const serious = result.violations.filter(
      (v) => (v.impact === 'serious' || v.impact === 'critical') && !LAYOUT_RULES.has(v.id),
    );
    expect(serious).toEqual([]);
  });
});
