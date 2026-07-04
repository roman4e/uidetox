# Culinary → UIDetox Feature Requests — Batch 00

**Status:** CLOSED — all requests implemented and shipped in UIDetox.
**Reference:** [`../../REFERENCE.md`](../../REFERENCE.md) documents the delivered APIs.

Consumer: **CulinaryGraph** (`~/Work/My/Culinary`) — a chef's DAG-based recipe designer built on FastAPI + Postgres backend, UIDetox frontend.

Original scope: the framework capabilities Culinary needed before its frontend implementation could start. Each doc explained the feature, motivating use cases from Culinary, proposed API, and acceptance criteria. Future request batches live in sibling folders (`req-01/`, `req-02/`, …).

## Delivery status

| # | Request | Priority | Shipped as |
|---|---|---|---|
| 04 | Island wrapper contract | P0 | `defineComponent({ onMount, render: 'never' })` + `ctx.effect` auto-dispose; `examples/island/CanvasClock.md`; `docs/patterns/island-wrapper.md`. See REFERENCE §5, §20. |
| 01 | Forms + schema validation | P0 | `uidetox/forms` — `f`, `form()`, `bind=${field}`, `<field-error>`; `examples/forms/IngredientForm.dtx`. See REFERENCE §17. |
| 02 | HTTP client + OpenAPI types | P1 | `uidetox/http` — `createHttpClient`, `resource`, `mutation`, `ApiError`; CLI `uidetox openapi`; 401 refresh with queue; auto-abort on unmount. See REFERENCE §18. |
| 03 | Virtual list | P1 | `<for viewport="virtual" row-height=… overscan=…>` (attribute on existing `<for>`, alias `<virtual-for>`); `examples/virtual/IngredientList.dtx`. See REFERENCE §9. |
| 05 | Drag & drop traits | P1 | `runtime/dnd` — `use="draggable/droppable/sortable"`, imperative `attach*` helpers; `examples/dnd/Palette.dtx`. See REFERENCE §16. |
| 06 | i18n (formatting) | P2 | `uidetox/i18n` — `fmt.number/percent/delta/qty/date/dateTime/relative`, `registerUnit` with dimension + auto-scale, `registerI18nFilters()` for template pipes. See REFERENCE §19. |
| 07 | `shallow()` + `batch()` | P2 | `state.ts` exports `state`, `shallow`, `batch`; `observer.ts` — `untrack`, `untracked`. See REFERENCE §2. |

## Bonus features delivered

- **`task` — detached async work** (Phase 4b). Reactive async side-effect off the render frame, per-run `AbortSignal`, auto-abort on re-run and on unmount. `ctx.task` inside components. See REFERENCE §10.
- **Section-based `.dtx` grammar** (Phase 4a). `template … end template`, `script` vs `actions` (host-exposed methods), `props` typed lines, `#name` element refs, `detox.toml` resolver, `declare` reusables. See REFERENCE §7.
- **DOM staging** — `mutate`, `mutateStructural`, `readStaged`, `measure`. See REFERENCE §3.
- **Animations** — `flip`, `animate`, `viewTransition`, reduced-motion aware. See REFERENCE §4.
- **DevTools** — `inspectComponentTree`. Component tree is real DOM so browser DevTools already show it. See REFERENCE §21.

## Syntax note (Phase 4a migration)

`.dtx` moved from brace-delimited bodies (`template { … }`) to line-based sections with `end <keyword>`. Culinary frontend authors against the new syntax exclusively. Culinary side has re-checked its architecture assumptions accordingly.

## Not blocking MVP (unchanged)

- Rich message-catalog i18n — MVP is uk-UA only.
- File upload — MVP uses generated placeholders.
- Multi-select drag, cross-window DnD.
- SWR-style HTTP cache.
- Variable-height virtual list.

## Feedback loop — going forward

Culinary side will:
- Open new request batches (`req-NN/`) as they surface during frontend work.
- Post real-world code samples that exercise each feature (for your test suite / examples).
- Report API drift or bugs found while consuming.

UIDetox side, please:
- Notify Culinary when a shipped feature changes API before wider adoption.
