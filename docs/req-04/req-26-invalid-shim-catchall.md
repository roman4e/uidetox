# REQ-26 — Generated dtx-shim emits invalid TS for the `**` catch-all route

**Requested by:** SOPP / ALM frontend
**Priority:** **P1** — the generated `.uidetox/dtx-shims.d.ts` is unparseable,
so a consumer that includes it in `tsc` cannot type-check at all. Workaround is
to exclude the plugin file and hand-maintain shims, which defeats the point.

## Symptom

With a catch-all route in `routes.dtx`:

```
"**" -> Board status=404
```

the generator emits a garbage tag interface from the `**` pattern:

```ts
interface //Element extends HTMLElement {}
interface HTMLElementTagNameMap {
  "//": //Element;
}
```

`//` is parsed as a line comment → `interface  extends HTMLElement` →
`error TS1110: Type expected` at that line. Every consumer `tsc --noEmit` fails.

Reproduce: `examples/culinary-lite` uses `"**" -> NotFound` and generates a
valid `app-not-found` interface — the break appears when the catch-all handler
is a component whose tag the generator tries to synthesise from the **route
pattern** (`**`) rather than the **handler's tag**.

## Request

- Derive the tag-map entry from the route **handler's** component tag, never
  from the path pattern. A `**` (or `:param`) segment is not an element name.
- Skip emitting a tag interface entirely when a handler is reused across
  multiple routes (Board is both `/` and `**` here) — one declaration, no
  duplicate `HTMLElementTagNameMap` blocks.
- The generated `.d.ts` must always be valid TypeScript (add a compile check to
  the generator's own tests: feed a routes file with `:param` + `**` and assert
  `tsc` accepts the output).

## Acceptance

- `routes.dtx` with a `"**"` catch-all produces a `.uidetox/dtx-shims.d.ts` that
  `tsc --noEmit` accepts.
- Reused handlers yield a single tag interface, no duplicates.
