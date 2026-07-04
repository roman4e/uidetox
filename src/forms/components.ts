import { effect } from '../runtime/effect.js';
import type { FieldHandle } from './form.js';

/**
 * `<field-error>` — renders a field's first error message reactively.
 * The field handle is passed via the `of` property (property binding: `.of=${fm.field('name')}`).
 * Renders nothing until a field is attached and it has an error.
 */
class FieldError extends HTMLElement {
  private _field: FieldHandle | null = null;
  private _dispose: (() => void) | null = null;

  set of(field: FieldHandle | null) {
    this._field = field;
    this._attach();
  }
  get of(): FieldHandle | null {
    return this._field;
  }

  private _attach(): void {
    this._dispose?.();
    if (!this._field) {
      this.textContent = '';
      return;
    }
    const field = this._field;
    this._dispose = effect(() => {
      const msg = field.error;
      this.textContent = msg ?? '';
      if (msg) this.setAttribute('visible', '');
      else this.removeAttribute('visible');
    });
  }

  disconnectedCallback(): void {
    this._dispose?.();
    this._dispose = null;
  }
}

/** Registers the forms custom elements. Idempotent. */
export function registerFormComponents(): void {
  if (typeof customElements === 'undefined') return;
  if (!customElements.get('field-error')) {
    customElements.define('field-error', FieldError);
  }
}
