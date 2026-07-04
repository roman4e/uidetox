# Culinary → UIDetox Feature Requests

Consumer: **CulinaryGraph** (`~/Work/My/Culinary`) — a chef's DAG-based recipe designer built on FastAPI + Postgres backend, UIDetox frontend.

These requests capture the framework capabilities Culinary needs before its frontend implementation can start comfortably. Each doc explains the feature, motivating use cases from Culinary, proposed API, and acceptance criteria.

## Priority order

| # | Request | Priority | Effort | Blocks |
|---|---|---|---|---|
| 04 | Island wrapper contract | **P0** | small | DAG editor (Cytoscape.js) |
| 01 | Forms + schema validation | **P0** | medium | Every input screen |
| 02 | HTTP client + OpenAPI types | P1 | small | All data screens (workaround: raw fetch) |
| 03 | `<virtual-for>` directive | P1 | medium | USDA library (workaround: cap list) |
| 05 | Drag & drop traits | P1 | small | Graph palette (workaround: hand-rolled pointer events) |
| 06 | Minimal i18n (formatting) | P2 | small | Ingredient tables (workaround: inline `Intl` calls) |
| 07 | `shallow()` + `batch()` | P2 | small | Perf when graph is large (measure first) |

## Suggested implementation order

1. **REQ-04** — island wrapper. Small doc + a couple of lifecycle guarantees. Unblocks the biggest UI piece (graph editor).
2. **REQ-01** — forms. Largest single item. Best done in parallel with REQ-04 since it does not overlap.
3. **REQ-02** — HTTP + OpenAPI. Starts making sense once auth flow is being built.
4. **REQ-03** and **REQ-05** — can slot in any time before the ingredient library / graph editor screens are polished.
5. **REQ-06** — small, drop in whenever convenient.
6. **REQ-07** — defer until first performance measurement shows a problem.

## What is NOT requested

Culinary already assumes these features (from your existing runtime index):

- `state`, `derived`, `effect`, scheduler
- `defineComponent`, `defineEmits`, custom-element tag conventions
- `<if>`, `<for>`, `<case>`, `<include>`, `<lazy-load>` directives
- Router (`<Router>`, `<Route>`, guards, layouts, param types)
- Registry + tokens (`createToken`, `registry.provide/get`)
- Traits + filters mechanism (existing infrastructure — REQ-05 and REQ-06 register into these)
- SSR / hydrate (used opportunistically)
- DevTools inspector
- Anim primitives (FLIP)
- Markdown SFC + `.dtx` DSL

## Not blocking MVP

These are noted but not requested for MVP:

- SSR support for island components (canvas-based libs) — mark them `render: never` and move on.
- Rich message-catalog i18n — MVP is uk-UA only, inline literals.
- File upload — Culinary MVP generates placeholder images.
- Multi-select drag, cross-window DnD.
- SWR-style HTTP cache.
- Variable-height virtual list.

## Feedback loop

Culinary side will:
- Report bugs / rough edges as they surface during frontend work.
- Post real-world code samples that exercise each new feature (for your test suite / examples).
- Flag when a P2 becomes a P0 (e.g. perf gate breached).

UIDetox side, please:
- Update each request doc's status header when work starts / ships.
- Notify Culinary when a shipped feature changes API before wider adoption.
