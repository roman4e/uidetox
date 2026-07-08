import { defineComponent } from '../runtime/index.js';
import type { TemplateCtx } from '../runtime/component.js';

// Semantic-UI-flavoured primitive kit. Real custom-element tags; zero baked-in
// colour — everything derives from CSS custom properties with neutral fallbacks,
// so a host theme drives the palette. Style by tag + structural block.

const el = (tag: string, attrs: Record<string, string> = {}, children: Node[] = []): HTMLElement => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  for (const c of children) n.appendChild(c);
  return n;
};
const slot = (name?: string): HTMLElement => el('slot', name ? { name } : {});

function reflect(ctx: TemplateCtx, node: HTMLElement, attrs: Record<string, () => string | boolean | undefined>): void {
  ctx.effect(() => {
    for (const [name, get] of Object.entries(attrs)) {
      const v = get();
      if (v === false || v === undefined || v === null) node.removeAttribute(name);
      else node.setAttribute(name, v === true ? '' : String(v));
    }
  });
}

// ─── ui-button ───────────────────────────────────────────────────────────────
defineComponent({
  tag: 'ui-button',
  props: ['variant', 'size', 'disabled', 'loading'],
  boot: (ctx) => {
    const btn = el('button', { type: 'button' }, [slot()]) as HTMLButtonElement;
    reflect(ctx, btn, {
      'data-variant': () => (ctx.props.variant as string) ?? 'basic',
      'data-size': () => (ctx.props.size as string) ?? 'md',
      'aria-busy': () => (ctx.props.loading != null ? 'true' : false),
    });
    ctx.effect(() => { btn.disabled = ctx.props.disabled != null || ctx.props.loading != null; });
    return btn;
  },
  style: `:host,ui-button{display:inline-block}
button{font:inherit;cursor:pointer;border:1px solid var(--ui-border,#d4d4d5);border-radius:var(--ui-radius,.35rem);padding:.55em 1.1em;background:var(--ui-button-bg,#e8e8e8);color:var(--ui-button-fg,#1b1c1d)}
button[data-variant=primary]{background:var(--ui-primary,#2185d0);color:var(--ui-primary-fg,#fff);border-color:transparent}
button[data-variant=subtle]{background:transparent;border-color:transparent;color:var(--ui-fg,#1b1c1d)}
button[data-size=sm]{padding:.4em .8em;font-size:.9em}
button[data-size=lg]{padding:.7em 1.4em;font-size:1.1em}
button:disabled{opacity:.5;cursor:not-allowed}
button[aria-busy=true]{cursor:progress}`,
});

// ─── ui-label ────────────────────────────────────────────────────────────────
defineComponent({
  tag: 'ui-label',
  props: ['tone', 'size'],
  boot: (ctx) => {
    const span = el('span', {}, [slot()]);
    reflect(ctx, span, {
      'data-tone': () => (ctx.props.tone as string) ?? 'neutral',
      'data-size': () => (ctx.props.size as string) ?? 'md',
    });
    return span;
  },
  style: `span{display:inline-block;padding:.3em .7em;border-radius:999px;font-size:.82em;line-height:1;background:var(--ui-label-bg,#e8e8e8);color:var(--ui-label-fg,#333)}
span[data-tone=ok]{background:var(--ui-ok,#21ba45);color:#fff}
span[data-tone=warn]{background:var(--ui-warn,#fbbd08);color:#333}
span[data-tone=info]{background:var(--ui-info,#31ccec);color:#fff}
span[data-tone=accent]{background:var(--ui-accent,#a333c8);color:#fff}
span[data-size=sm]{font-size:.72em}`,
});

// ─── ui-card ─────────────────────────────────────────────────────────────────
defineComponent({
  tag: 'ui-card',
  boot: (ctx) => el('div', { class: 'card' }, [
    el('div', { class: 'header' }, [slot('header')]),
    el('div', { class: 'content' }, [slot()]),
    el('div', { class: 'meta' }, [slot('meta')]),
    el('div', { class: 'actions' }, [slot('actions')]),
  ]),
  style: `.card{border:1px solid var(--ui-border,#d4d4d5);border-radius:var(--ui-radius,.5rem);background:var(--ui-surface,#fff);box-shadow:var(--ui-shadow,0 1px 3px rgba(0,0,0,.08));overflow:hidden}
.card .header{padding:.9em 1.1em;font-weight:600;border-bottom:1px solid var(--ui-border,#eee)}
.card .header:empty,.card .meta:empty,.card .actions:empty{display:none}
.card .content{padding:1.1em}
.card .meta{padding:.5em 1.1em;color:var(--ui-muted,#888);font-size:.85em}
.card .actions{padding:.7em 1.1em;border-top:1px solid var(--ui-border,#eee);display:flex;gap:.5em}`,
});

// ─── ui-segment ──────────────────────────────────────────────────────────────
defineComponent({
  tag: 'ui-segment',
  props: ['raised', 'vertical'],
  boot: (ctx) => {
    const div = el('div', { class: 'segment' }, [slot()]);
    reflect(ctx, div, {
      'data-raised': () => (ctx.props.raised != null ? true : false),
      'data-vertical': () => (ctx.props.vertical != null ? true : false),
    });
    return div;
  },
  style: `.segment{border:1px solid var(--ui-border,#d4d4d5);border-radius:var(--ui-radius,.4rem);background:var(--ui-surface,#fff);padding:1em}
.segment[data-raised]{box-shadow:var(--ui-shadow,0 2px 6px rgba(0,0,0,.12))}
.segment[data-vertical]{border-radius:0;border-left:0;border-right:0}`,
});

// ─── ui-message ──────────────────────────────────────────────────────────────
defineComponent({
  tag: 'ui-message',
  props: ['tone', 'header'],
  boot: (ctx) => {
    const box = el('div', { class: 'message', role: 'status' }, []);
    const head = el('div', { class: 'msg-header' });
    box.append(head, el('div', { class: 'msg-body' }, [slot()]));
    reflect(ctx, box, { 'data-tone': () => (ctx.props.tone as string) ?? 'neutral' });
    ctx.effect(() => { head.textContent = (ctx.props.header as string) ?? ''; head.style.display = head.textContent ? '' : 'none'; });
    return box;
  },
  style: `.message{border:1px solid var(--ui-border,#d4d4d5);border-radius:var(--ui-radius,.4rem);padding:.9em 1.1em;background:var(--ui-message-bg,#f8f8f9);color:var(--ui-fg,#1b1c1d)}
.message .msg-header{font-weight:600;margin-bottom:.25em}
.message[data-tone=ok]{background:var(--ui-ok-bg,#e6ffed);border-color:var(--ui-ok,#21ba45)}
.message[data-tone=warn]{background:var(--ui-warn-bg,#fffaf3);border-color:var(--ui-warn,#fbbd08)}
.message[data-tone=info]{background:var(--ui-info-bg,#f0f9ff);border-color:var(--ui-info,#31ccec)}`,
});

// ─── ui-input ────────────────────────────────────────────────────────────────
// A form field wrapper. Proxies `value` + relays `input` so `bind=${fm.field(..)}`
// (which reads/writes `.value` on the host and listens for input) two-ways it.
defineComponent({
  tag: 'ui-input',
  props: ['label', 'error', 'icon', 'type', 'placeholder'],
  boot: (ctx) => {
    const wrap = el('div', { class: 'field' });
    const id = `ui-in-${Math.random().toString(36).slice(2, 8)}`;
    const label = el('label', { for: id });
    const input = el('input', { id }) as HTMLInputElement;
    const err = el('div', { class: 'err' });
    wrap.append(label, input, err);

    ctx.effect(() => {
      label.textContent = (ctx.props.label as string) ?? '';
      label.style.display = label.textContent ? '' : 'none';
      input.type = (ctx.props.type as string) ?? 'text';
      if (ctx.props.placeholder != null) input.placeholder = String(ctx.props.placeholder);
      const e = (ctx.props.error as string) ?? '';
      err.textContent = e;
      wrap.setAttribute('data-invalid', e ? 'true' : 'false');
      if (e) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    });

    // value proxy + input relay so forms `bind=` works against the host.
    const host = ctx.host as HTMLElement & { value?: string };
    Object.defineProperty(host, 'value', {
      configurable: true,
      get: () => input.value,
      set: (v: unknown) => { input.value = v == null ? '' : String(v); },
    });
    input.addEventListener('input', () => host.dispatchEvent(new Event('input')));
    input.addEventListener('change', () => host.dispatchEvent(new Event('change')));
    input.addEventListener('blur', () => host.dispatchEvent(new Event('blur')));
    ctx.refs.input = input;
    return wrap;
  },
  style: `.field{display:grid;gap:.3em}
.field label{font-size:.85em;font-weight:600;color:var(--ui-fg,#1b1c1d)}
.field input{font:inherit;padding:.55em .7em;border:1px solid var(--ui-border,#d4d4d5);border-radius:var(--ui-radius,.35rem);background:var(--ui-surface,#fff);color:var(--ui-fg,#1b1c1d)}
.field[data-invalid=true] input{border-color:var(--ui-error,#db2828)}
.field .err{color:var(--ui-error,#db2828);font-size:.8em;min-height:1em}
.field .err:empty{display:none}`,
});

// ─── ui-menu / ui-menu-item ──────────────────────────────────────────────────
defineComponent({
  tag: 'ui-menu',
  props: ['vertical'],
  boot: (ctx) => {
    const nav = el('nav', { class: 'menu', role: 'menu' }, [slot()]);
    reflect(ctx, nav, { 'data-vertical': () => (ctx.props.vertical != null ? true : false) });
    return nav;
  },
  style: `.menu{display:flex;border:1px solid var(--ui-border,#d4d4d5);border-radius:var(--ui-radius,.4rem);background:var(--ui-surface,#fff);overflow:hidden}
.menu[data-vertical]{flex-direction:column}`,
});
defineComponent({
  tag: 'ui-menu-item',
  props: ['active'],
  boot: (ctx) => {
    const a = el('div', { class: 'item', role: 'menuitem', tabindex: '0' }, [slot()]);
    reflect(ctx, a, {
      'data-active': () => (ctx.props.active != null ? true : false),
      'aria-current': () => (ctx.props.active != null ? 'true' : false),
    });
    return a;
  },
  style: `.item{padding:.7em 1.1em;cursor:pointer;color:var(--ui-fg,#1b1c1d)}
.item:hover{background:var(--ui-hover,#f2f2f2)}
.item[data-active]{background:var(--ui-active,#e0e0e0);font-weight:600}`,
});

// ─── ui-dropdown ─────────────────────────────────────────────────────────────
// `:options=${[{value,label}]}` (property) + emits `change` with the value.
defineComponent({
  tag: 'ui-dropdown',
  props: ['placeholder'],
  boot: (ctx) => {
    const select = el('select', {}) as HTMLSelectElement;
    // `:options` is a property binding, not an attribute — expose a reactive
    // `options` property on the host so writes flow into ctx.props (and re-render).
    const host = ctx.host as unknown as Record<string, unknown>;
    if (host.options !== undefined) ctx.props.options = host.options;
    Object.defineProperty(ctx.host, 'options', {
      configurable: true,
      get: () => ctx.props.options,
      set: (v: unknown) => { ctx.props.options = v; },
    });
    ctx.effect(() => {
      const options = (ctx.props.options as Array<{ value: string; label: string }>) ?? [];
      const ph = ctx.props.placeholder as string | undefined;
      select.replaceChildren();
      if (ph) select.appendChild(el('option', { value: '' }, [document.createTextNode(ph)]));
      for (const o of options) select.appendChild(el('option', { value: String(o.value) }, [document.createTextNode(o.label)]));
    });
    select.addEventListener('change', () => ctx.emit('change', { value: select.value }));
    ctx.refs.select = select;
    return select;
  },
  style: `select{font:inherit;padding:.55em .7em;border:1px solid var(--ui-border,#d4d4d5);border-radius:var(--ui-radius,.35rem);background:var(--ui-surface,#fff);color:var(--ui-fg,#1b1c1d)}`,
});

// ─── ui-modal ────────────────────────────────────────────────────────────────
defineComponent({
  tag: 'ui-modal',
  props: ['open'],
  boot: (ctx) => {
    const backdrop = el('div', { class: 'backdrop' });
    const dialog = el('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', tabindex: '-1' }, [
      el('div', { class: 'm-header' }, [slot('header')]),
      el('div', { class: 'm-body' }, [slot()]),
      el('div', { class: 'm-actions' }, [slot('actions')]),
    ]);
    backdrop.appendChild(dialog);
    ctx.refs.dialog = dialog;

    const isOpen = (): boolean => ctx.props.open != null;
    ctx.effect(() => {
      const open = isOpen();
      backdrop.style.display = open ? '' : 'none';
      if (open) queueMicrotask(() => dialog.focus());
    });
    // backdrop click + Escape close.
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) ctx.emit('close', {}); });
    return backdrop;
  },
  onMount: (ctx) => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && ctx.props.open != null) ctx.emit('close', {});
      if (e.key === 'Tab' && ctx.props.open != null) trapFocus(ctx.refs.dialog as HTMLElement, e);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  },
  style: `.backdrop{position:fixed;inset:0;background:var(--ui-backdrop,rgba(0,0,0,.4));display:flex;align-items:center;justify-content:center;z-index:1000}
.dialog{background:var(--ui-surface,#fff);border-radius:var(--ui-radius,.5rem);min-width:20rem;max-width:90vw;box-shadow:0 8px 30px rgba(0,0,0,.25);outline:none}
.dialog .m-header{padding:1em 1.2em;font-weight:600;border-bottom:1px solid var(--ui-border,#eee)}
.dialog .m-header:empty,.dialog .m-actions:empty{display:none}
.dialog .m-body{padding:1.2em}
.dialog .m-actions{padding:.9em 1.2em;border-top:1px solid var(--ui-border,#eee);display:flex;gap:.5em;justify-content:flex-end}`,
});

function trapFocus(container: HTMLElement, e: KeyboardEvent): void {
  const focusables = container.querySelectorAll<HTMLElement>(
    'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])',
  );
  if (focusables.length === 0) { e.preventDefault(); container.focus(); return; }
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = (container.getRootNode() as Document).activeElement;
  if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
}

/** All UI-kit tags are registered on import; call this if you need an explicit hook. */
export function registerUi(): void { /* registration happens on module import */ }
