# REQ-01 — Forms Module

**Status:** In progress
**Priority:** P0 (Culinary blocker)
**Sub-path:** `ui-detox/forms`
**Decisions:** fluent schema DSL, dotted/bracketed path strings, dependency-free (own validator).

## 1. Schema DSL (fluent)

```ts
import { f } from 'ui-detox/forms';

f.string().min(2).max(200).optional()
f.number().int().positive().optional()
f.boolean()
f.enum(['a', 'b'])
f.object({ name: f.string(), taste: f.object({ salt: f.number().min(0).max(1) }) })
f.array(f.object({ code: f.string() })).min(1)
f.string().refine(v => v.length > 0, 'required')
f.string().asyncCheck(async v => (await isFree(v)) || 'taken', { debounceMs: 400 })
```

Each schema validates a value and writes messages into an errors map keyed by
dotted path. Object/array schemas recurse, extending the path.

## 2. `form()`

```ts
const fm = form({ schema, initial, onSubmit });
```

Reactive surface (all backed by `state`):
- `fm.values` — reactive proxy of current values.
- `fm.errors` — reactive `Record<path, string[]>`.
- `fm.dirty` — reactive boolean (deep compare vs initial).
- `fm.touched` — reactive `Record<path, boolean>`.
- `fm.valid` — reactive boolean (no sync errors + no pending).
- `fm.submitting` — reactive boolean.

Methods:
- `fm.field(path)` → `{ value, error, dirty, touched, pending, setValue, setTouched, reset }` plus array helpers `append/removeAt/moveTo` when the field is an array.
- `fm.rule(pred, msg, paths)` — cross-field rule; runs on every relevant change.
- `fm.watch(paths, fn, { debounceMs })` — debounced side-effect.
- `fm.submit(ev?)` — awaits async validators, then `onSubmit(values)`; toggles `submitting`.
- `fm.reset(newInitial?)` — resets values/dirty/touched/errors.

Paths: dotted / bracketed (`'nutrients.0.code'`, `'taste.salt'`).

## 3. Template integration

- `bind=${fm.field('...')}` — two-way value + change listener + touched flag.
  Kind-detected from the element: `<input>` value, `checkbox` checked,
  `range`/`number` numeric, `<select>` value, `<textarea>`.
- `<field-error of=${fm.field('...')}/>` — renders the field's error text
  (nothing when pristine or valid).
- `<array-field of=${fm.field('...')} item="row" index="i">` — projects children
  per array item, keyed by identity; exposes `append/removeAt/moveTo`.

## 4. Async validation

Field-level async validators debounce and expose `fm.field(path).pending`.
Submit awaits pending validators. Race: last-write-wins by generation counter.

## 5. File Layout

```
src/forms/
  schema.ts        # f builders + validate
  path.ts          # get/set by dotted path
  form.ts          # form() store + field handles
  bind.ts          # __bindField runtime helper
  components.ts    # field-error + array-field custom elements
  index.ts         # barrel (ui-detox/forms)
tests/forms/*.test.ts
examples/forms/ingredient.md
```

## 6. Non-Goals

Wizard/multi-step, rich-text, file upload (deferred per request).
