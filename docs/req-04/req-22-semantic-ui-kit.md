# REQ-22 — Semantic-UI primitive component kit

**Requested by:** SOPP / ALM frontend
**Priority:** **P1** — every SOPP view (board, backlog, sprint, search,
comments, admin) re-implements the same primitives inline. A shipped kit keeps
the app free of ad-hoc markup and gives a single, consistent, tag-scoped
surface to theme.

## Motivation

SOPP builds its whole UI from a handful of primitives that today do not exist
in UIDetox, so each page hand-rolls `<span class="badge">`, `<div class="card">`
etc. We want these as **real UIDetox components** (real tags in the DOM) so the
consumer styles them by tag/structural-block (`ui-label`, `ui-card .content`),
never by importing a stylesheet of utility classes.

The look is **Semantic UI**: bordered segments, pill labels, buttons with
states, menus, messages. Structure only — colours/tokens stay the consumer's
(SOPP themes them via CSS custom properties).

## Proposed components

A `uidetox/ui` entry (or a small SFC pack the consumer copies) exposing:

| Tag           | Purpose                                   | Key props / slots |
| ------------- | ----------------------------------------- | ----------------- |
| `ui-button`   | action button                             | `variant` (primary/basic/subtle), `size`, `?disabled`, `?loading`; slot = label |
| `ui-label`    | pill / badge                              | `tone` (neutral/ok/warn/info/accent), `size`; slot |
| `ui-card`     | bordered content card                     | slots: `header`, default, `meta`, `actions` |
| `ui-segment`  | grouping surface (raised/vertical)        | `?raised`, `?vertical` |
| `ui-input`    | text field wrapper (works with forms §17) | `label`, `?error`, `?icon`; `bind=` two-way |
| `ui-menu`     | horizontal/vertical nav menu              | `vertical`; items via slot + `ui-menu-item[active]` |
| `ui-message`  | inline message / empty-state             | `tone`, `header`; slot |
| `ui-dropdown` | select / action menu                      | `:options`, `@change` |
| `ui-modal`    | dialog                                    | `?open`, `@close`; slots: `header`, default, `actions` |

Requirements:

- Real custom-element tags (View Source shows `<ui-card>`), so consumers style
  by `ui-card { … }` / `ui-card .content p { … }` — the SOPP styling contract.
- Zero baked-in colour: derive from CSS custom properties with sensible
  fallbacks, so a host theme (SOPP's `tokens.css`) drives palette.
- Accessible defaults: `ui-button` is a real `<button>`; `ui-modal` traps focus
  + closes on Escape; `ui-input` wires `label`/`for`. Pass the existing
  `test:a11y` (axe) harness.
- Ship each with the standard SFC test blocks (`fixtures`, `test`,
  `test:visual`, `test:a11y`).

## Acceptance

- `import { UiButton, UiLabel, UiCard, … } from 'uidetox/ui'` (or documented SFC
  pack) registers the tags.
- A SOPP page can render `<ui-card><p slot="header">…</p>…</ui-card>` and style
  it purely by tag selectors.
- axe-clean; visual snapshots committed.
