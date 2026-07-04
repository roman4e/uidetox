# Pattern: Forms (schema-driven, reactive)

`uidetox/forms` gives every screen a reactive value store, per-field
validation from a declarative schema, aggregated form state, two-way
template binding, and async validators — with **no runtime dependency**.

Import from the sub-path:

```ts
import { f, form, registerFormComponents } from 'uidetox/forms';
```

## Schema DSL

Build a schema with the `f` factory. Types: `string`, `number`, `boolean`,
`enum`, `object`, `array`. Chain constraints; mark `.optional()`.

```ts
const schema = f.object({
  name: f.string().min(2).max(200),
  densityGml: f.number().positive().optional(),
  category: f.enum(['vegetable', 'meat', 'dairy']),
  nutrients: f.array(f.object({
    code: f.string().min(1),
    amountPer100g: f.number().min(0),
  })).min(1),
});
```

`.refine(pred, msg)` adds a custom sync check.
`.asyncCheck(fn, { debounceMs })` adds a debounced async check (see below).

## Form store

```ts
const fm = form({
  schema,
  initial: { name: '', densityGml: undefined, nutrients: [] },
  onSubmit: async (value) => { await api.ingredients.create(value); },
});
```

Reactive surface (read them in templates / effects — they track):

| Member | Meaning |
|---|---|
| `fm.values` | reactive proxy of current values |
| `fm.errors` | reactive `map<path, string[]>` |
| `fm.dirty` | any value differs from initial (deep compare) |
| `fm.valid` | no errors **and** no pending async checks |
| `fm.submitting` | true while `submit()` runs |
| `fm.touched` | reactive `map<path, bool>` |

Paths are dotted or bracketed: `'name'`, `'taste.saltiness'`,
`'nutrients.0.code'`, `'nutrients[0].code'`.

## Field handles

`fm.field(path)` returns a handle with reactive getters plus mutators:

```ts
const name = fm.field('name');
name.value            // current value
name.error            // first error (undefined if valid/pristine)
name.errors           // all errors
name.dirty            // differs from initial
name.touched          // blurred at least once
name.pending          // async check in flight

name.setValue('Salt')
name.setTouched(true)
name.reset()

// array fields:
fm.field('nutrients').append({ code: '', amountPer100g: 0 })
fm.field('nutrients').removeAt(2)
fm.field('nutrients').moveTo(2, 0)
```

## Template binding

`bind=${fm.field(path)}` is two-way sugar: it reflects the value into the
element and writes changes back (plus marks touched on blur). Kind-detection
is by element: text/number/range/checkbox/select.

```html
<form @submit=${fm.submit}>
  <input bind=${fm.field('name')} placeholder="Назва"/>
  <field-error .of=${fm.field('name')}></field-error>

  <input type="number" bind=${fm.field('densityGml')}/>

  <for each=${fm.values.nutrients} item="row" key="index">
    <input bind=${fm.field(`nutrients.${index}.code`)}/>
    <input type="number" bind=${fm.field(`nutrients.${index}.amountPer100g`)}/>
    <button type="button" @click=${() => fm.field('nutrients').removeAt(index)}>×</button>
  </for>
  <button type="button" @click=${() => fm.field('nutrients').append({ code: '', amountPer100g: 0 })}>
    + нутрієнт
  </button>

  <button type="submit" ?disabled=${!fm.valid || fm.submitting}>Зберегти</button>
</form>
```

`<field-error>` renders a field's first error reactively; pass the handle via
the `of` **property** (`.of=${...}`). Register the element once at startup:
`registerFormComponents()`. It gains a `visible` attribute while an error
shows, for styling: `field-error[visible] { color: crimson; }`.

> **Array rows.** There is no dedicated `<ArrayField>` element — an array is
> just `<for each=${fm.values.arr}>` plus the field handle's `append` /
> `removeAt` / `moveTo` helpers. Key the `<for>` for stable per-row bindings.

## Cross-field rules

```ts
fm.rule(v => v.neto <= v.brutto, 'neto must not exceed brutto', ['neto']);
```

Runs on every relevant change; the message attaches to each listed path.

## Async validators

Attach a debounced async check to a field schema. While it runs,
`field.pending` is true and `fm.valid` is false. The store keeps only the
latest run's verdict (last-write-wins on rapid edits) and skips the async
call entirely while a sync error already stands.

```ts
const name = f.string().min(2).asyncCheck(
  async (v) => (await api.ingredients.isNameFree(v)) || "Ім'я зайняте",
  { debounceMs: 400 },
);
```

## Watch

Run a side-effect when a path changes (e.g. debounced similarity search):

```ts
const stop = fm.watch('name', (name) => { void search(name); });
// fires immediately, then on every change; call stop() to dispose.
```

## Submit & reset

- `fm.submit(ev?)` — `preventDefault`s, re-validates, and runs `onSubmit`
  with a cloned value only when valid. `submitting` reflects state.
- `fm.reset(newInitial?)` — restores values (optionally to a new baseline)
  and clears dirty / touched / errors / pending.

See `examples/forms/IngredientForm.dtx` for a full component.
