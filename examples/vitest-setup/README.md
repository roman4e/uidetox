# vitest-setup

Recipe for colocated component tests: author `ts test` / `json fixtures` /
`ts mock` blocks inside a component's Markdown SFC, run them with Vitest.

```
pnpm test
```

How it works:
- `vitest.config.ts` registers `uidetoxEsbuild({ mode: 'test' })` — it compiles
  `.dtx`/`.md` and, in `test` mode, re-emits their `ts test` blocks as an
  `export function __tests()` (and `export const __fixtures`).
- `Counter.test.ts` imports `__tests` from `Counter.md` and hands it to
  `describe`.
- dev/build modes strip the test blocks entirely — no test code ships to prod.

See `docs/patterns/vite-plugin.md` § *Colocated tests*.
