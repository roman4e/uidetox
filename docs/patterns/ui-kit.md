# Pattern: Semantic-UI primitive kit (`uidetox/ui`)

Real custom-element primitives — View Source shows `<ui-card>`, so you style by
**tag + structural block**, never by utility classes. Importing the module
registers all tags:

```ts
import 'uidetox/ui';          // registers ui-button, ui-card, … (side-effect)
// or: import { registerUi } from 'uidetox/ui'; registerUi();
```

Zero baked-in colour — every component derives from CSS custom properties with
neutral fallbacks, so your theme drives the palette:

```css
:root {
  --ui-primary: #2185d0;  --ui-border: #d4d4d5;  --ui-surface: #fff;
  --ui-ok: #21ba45;  --ui-warn: #fbbd08;  --ui-error: #db2828;  --ui-radius: .4rem;
}
ui-card { /* style the tag directly */ }
ui-card .content p { /* … structural blocks */ }
```

## Components

| Tag | Notes |
|---|---|
| `ui-button` | wraps a real `<button>`; `variant` (primary/basic/subtle), `size`, `?disabled`, `?loading` (sets `aria-busy` + disables) |
| `ui-label` | pill; `tone` (neutral/ok/warn/info/accent), `size` |
| `ui-card` | named slots `header` / default / `meta` / `actions` (empty blocks hide) |
| `ui-segment` | `?raised`, `?vertical` |
| `ui-message` | `tone`, `header`; `role="status"` |
| `ui-input` | `label` (wired `for`/`id`), `error` (`aria-invalid`), `type`, `placeholder`. Proxies `value` + relays `input`, so `bind=${fm.field('x')}` two-ways it |
| `ui-menu` / `ui-menu-item` | `vertical`; item `active` → `aria-current` |
| `ui-dropdown` | `:options=${[{value,label}]}` (property) → emits `change` `{ value }` |
| `ui-modal` | `?open`; slots `header`/default/`actions`; `role="dialog"` + `aria-modal`, Escape/backdrop → `close`, focus trap |

```html
<ui-card>
  <span slot="header">Artifact #42</span>
  <p>Body content…</p>
  <span slot="meta">updated 2m ago</span>
  <ui-button slot="actions" variant="primary">Save</ui-button>
</ui-card>

<ui-input label="Title" bind=${fm.field('title')}></ui-input>

<ui-modal ?open=${open} @close=${() => open = false}>
  <span slot="header">Confirm</span>
  <p>Delete this artifact?</p>
  <ui-button slot="actions" variant="primary" @click=${confirm}>Delete</ui-button>
</ui-modal>
```

## a11y

`ui-button` is a real `<button>`; `ui-input` associates `label[for]`↔`input[id]`
and sets `aria-invalid`; `ui-modal` is `role="dialog" aria-modal`, closes on
Escape/backdrop and traps Tab focus. Structural a11y is unit-tested; layout/
contrast rules run under the visual (Playwright) harness.
