# Culinary → UIDetox Feature Requests — Batch 03

**Status:** OPEN

Single-item batch — an isolated critical blocker discovered after REQ-02
was closed. All REQ-08/09/10/11 shipped changes live in `src/` but never
reach consumers because `pnpm build` fails on pre-existing TypeScript
errors, leaving `dist/` stale.

## Requests

| # | Request | Priority |
|---|---|---|
| 13 | Unblock `pnpm build` — REQ-10/11 fixes unreachable via `link:.../dist` | **P0** |
| 14 | DTX import resolver rewrites bare npm specifiers as broken relative paths | **P0** — every `.dtx` file 500s |
| 15 | DTX compiler emits `.js` extension for local `.dtx` imports — Vite cannot resolve | **P0** — every dotted local ref 500s |
| 16 | `router` verb emits named imports; page components are default exports → `handler: undefined` | **P0** — router crashes in prod |
| 17 | Router outlet ignores `meta.layout` — screens render without their AppShell | P1 |
| 18 | Router matched params never reach page component (props.id === undefined) | **P0** |
| 19 | `resource.reload()` doesn't invalidate + `<for>` keyed diff appends stale items | **P0** |

See `req-13-unblock-build.md`.
