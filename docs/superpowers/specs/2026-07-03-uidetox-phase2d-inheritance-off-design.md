# UIDetox Phase 2d — DSL Inheritance + `off` + Python C3

**Status:** Draft (v0.1)
**Date:** 2026-07-03
**Depends on:** `2026-07-02-uidetox-phase1c-dsl-design.md` (DSL grammar), Phase 1c-a implementation (parser, emitter, runtime `defineTrait` / `defineFilter`).
**Owner:** roman4e@gmail.com

## 1. Purpose

Add three inter-related capabilities to the UIDetox DSL:

- `extends [a, b, c]` — a clause on every verb (`trait`, `filter`, `token`, `provide`) that lets a declaration inherit from one or more previously-declared items of the same kind.
- Python-C3 linearization — deterministic multi-inheritance order shared by every verb; the same MRO algorithm CPython uses.
- `off <event> <name>()` and `off <event> *()` — remove inherited event handlers (traits) or transformers (filters) from the merged chain.

## 2. Non-Goals (Phase 2d)

- `component` DSL — Phase 2e (this spec fixes the mechanics; Phase 2e adopts them).
- `route` DSL — Phase 2 later slot; adopts same mechanics without changes.
- Runtime hot-swap of an inheritance chain — reserved.

## 3. `extends` Clause

### 3.1 Grammar

```dtx
trait input-cleanup export appliesto [input, textarea]
on blur trim_handler() { this.el.value = this.el.value.trim(); }
on blur uppercase_first() { /* … */ }

trait strict-cleanup export extends [input-cleanup] appliesto [input]
off blur uppercase_first()
on blur reject_empty() { if (!this.el.value) this.el.dispatchEvent(new Event('invalid')); }
```

`extends [a, b, c]` may appear anywhere in the clause list of any verb. Referenced names must be **kebab-case identifiers** already imported or declared in the same file. Order in the list is significant — it feeds C3.

### 3.2 Type of the reference

Each `extends` entry resolves to a **compile-time symbol**, not a runtime lookup:

- Trait references resolve against previously-emitted `defineTrait` bindings (imported or same-file).
- Filter references resolve against `defineFilter` bindings.
- Token references resolve against `createToken` bindings.
- Provide references resolve against previously-declared `provide` blocks that share the same token.

The preprocessor injects a `extends: [<camelName>, …]` field into the emitted descriptor. The runtime performs linearization once at first use and caches the result on the descriptor object.

### 3.3 Cross-kind references

Each `extends` list is homogeneous — a trait can only extend traits, a filter only filters, etc. Cross-kind extension is a build error.

## 4. Python-C3 Linearization

### 4.1 Rules (verbatim from CPython)

Given `C extends [P1, P2, …, Pn]`, the linearization L[C] is:

```
L[C] = [C] + merge(L[P1], L[P2], …, L[Pn], [P1, P2, …, Pn])
```

where `merge` picks the **head** of the first list whose head does not appear in any other list's tail; that head is removed from every list and appended to the result; repeat until all lists are empty. If no valid head exists, raise `InconsistentHierarchyError` at build time.

### 4.2 Deterministic errors

- Duplicate parent in the same `extends` list → build error.
- Unresolvable head at any step (classic C3 failure) → build error with the offending residuals in the message.
- Extending an item not defined or not imported → build error.

### 4.3 Where linearization is applied

- **Trait:** L[child] used to walk handler-event maps in reverse so parents contribute earlier handlers.
- **Filter:** L[child] used to build the transformer chain (`parent.transformers` first, then child's; `off` operations edit the merged list).
- **Token:** L[child] used at Registry look-up time as a fallback chain.
- **Provide:** L[child] used to compose the default provider — child's default may `return this.super()` to invoke the next provider in the L[child] chain.

## 5. Trait Merge Semantics

Given L[C] = `[C, P1, P2]`:

- **Params.** `paramsSchema` for the merged trait is the union `P2 ⊕ P1 ⊕ C` (child last, wins on collision). Type of the resulting param is the child's type if collision. Type-tightening (e.g., parent `string`, child `string`) is allowed; widening is a build warning.
- **Props (`.prop = value`).** Same merge, child wins on collision. The runtime `props()` factory returns `Object.assign({}, ...parents.map(p => p.props()), child.props())`.
- **Handlers.** For each event key, the merged list is `parents[P2].handlers[event] ++ parents[P1].handlers[event] ++ own` (concatenation, LTR by L[C] tail then own last), then `off` operations are applied in declaration order.
- **`appliesto`.** Intersected with parents. If the intersection is empty, that is a build error — the child cannot apply anywhere.

## 6. Filter Merge Semantics

- **Input / output types.** Must be pointwise compatible. Child input type must be a subtype of every parent input type (validated at build time via a small structural checker; MVP: identical strings; extension in future for real TS type narrowing).
- **Transformers.** Concatenated `parents … own`; `off` may remove individual transformers by name (unnamed anonymous transformers cannot be removed individually but can be removed en-masse via `off transform *()`).
- **Params.** Same merge as traits.

## 7. Token Merge Semantics

A `token B extends [A]` declaration means "B is a specialisation of A". Runtime rule:

- `registry.get(B)` returns the provider registered for B if any; otherwise walks L[B] and returns the first ancestor that has a provider.
- `registry.provide(B, value)` sets B's own provider only.
- TypeScript emit: `const B = createToken<{parent-type}>('b', { extends: [A] })` — the `extends` payload is preserved for the Registry's chain look-up.

## 8. Provide Merge Semantics

A `provide` block that names a token which already has ancestors in L[token] can call `this.super()` inside its `default` member to invoke the next provider in the linearised chain.

```dtx
provide admin-user extends [current-user] from server
default resolveAdmin() {
  const base = await this.super();
  if (!base) return null;
  return { ...base, admin: await this.$api.isAdmin(base.id) };
}
```

`this.super()` returns the result of the next provider in L[token] tail; returns `undefined` if the chain is exhausted.

## 9. `off` Member

### 9.1 Grammar

```
off <event> <name>()           # remove named event handler (traits)
off <event> *()                # remove every handler for that event
off transform <name>()         # remove named filter transformer
off transform *()              # remove every transformer
```

### 9.2 Rules

- `off` only affects **inherited** members. `off X()` where X is declared in the same block is a build error.
- `off` must reference members present in some ancestor in L[C]; if the name is not found, build error.
- `off … *()` removes every ancestor member for that key, regardless of name.

### 9.3 Emit shape

```ts
export const strictCleanup = defineTrait('strict-cleanup', {
  appliesTo: ['input'],
  extends: [inputCleanup],
  off: { blur: ['uppercase_first'] },   // named removals
  handlers: {
    blur: [{ name: 'reject_empty', run(this: any) { /* … */ } }],
  },
  /* … */
});
```

The runtime resolves the merged handler map at first `installTraits()` for the trait, caching the result.

## 10. Runtime — `resolveLinearization()`

The runtime ships a single utility:

```ts
export interface Linearizable<T> {
  name: string;
  extends?: T[];
}

export function resolveLinearization<T extends Linearizable<T>>(desc: T): T[];
```

Implements C3 verbatim. Cached on the descriptor via a `Symbol.for('uidetox.mro')` property.

## 11. Compatibility

- Every Phase 1c-a `.dtx` file continues to compile — the new `extends` clause and `off` member are optional; absence yields the same emit as today.
- Existing `defineTrait` / `defineFilter` runtime signatures are extended with optional `extends?` and `off?` fields, both defaulted to empty.

## 12. File Layout Additions

```
src/
  compiler/
    dtx/
      inherit.ts             # parse + validate extends + off in parse.ts flow
      emit.ts                # MODIFIED — emit extends + off payloads
  runtime/
    mro/
      linearize.ts           # C3 implementation
      apply.ts               # apply merged handler/transformer/props to a descriptor
    traits/
      install.ts             # MODIFIED — use merged handler map from resolveLinearization
    filters/
      define.ts              # MODIFIED — build transformer chain from merged view
    registry.ts              # MODIFIED — walk token MRO on get()
tests/
  runtime/mro/linearize.test.ts
  runtime/mro/apply.test.ts
  runtime/traits/inheritance.test.ts
  runtime/filters/inheritance.test.ts
  runtime/registry/token-inheritance.test.ts
  compiler/dtx/inherit-emit.test.ts
  e2e/dtx-inheritance-basic.test.ts
```

## 13. Open Questions (deferred)

- Whether `this.super()` inside a trait handler should resolve to the next same-name handler (Scala-style) — Phase 2 later. MVP: `this.super()` is only meaningful in `provide`.
- Static "diamond warnings" beyond hard errors — reserved.
- Emitting a compact "flattened" trait when no descendants exist, to skip the MRO walk at runtime — future optimisation.
