# REQ-01 — Forms Module (schema-driven, reactive)

**Requested by:** Culinary (CulinaryGraph) frontend
**Priority:** P0 (blocker — every screen has non-trivial forms)
**Estimated effort:** medium (1-2 weeks)

## Purpose

Provide first-class form primitives: reactive value store, per-field validation from a declarative schema, aggregated form-level state (dirty / touched / valid / submitting / errors), and a clean binding syntax in templates. Without this, every screen re-invents the same boilerplate.

## Motivating use cases from Culinary

1. **Ingredient input form** — 15+ fields: name (unique per owner, min 2 chars), category (enum), density (positive number, optional), USDA id (optional integer), 8 taste axes (0..1 sliders), allergen multiselect (14 groups), diet-tag multiselect, dynamic list of nutrients (each row: nutrient code + amount per 100 g, positive number). Live similarity search fires on debounced `name` change AND on nutrient changes.
2. **Node inspector** — brutto and neto masses (positive numbers, neto ≤ brutto), label (required), ingredient reference (only for leaf nodes). Any change triggers `recompute_graph` refetch.
3. **Edge inspector** — operation type (enum), yield_factor (0..2), fat_added (>= 0), operation params (schema depends on operation type — polymorphic).
4. **Auth** — email + password.
5. **Fork conflict resolver** — radio group + optional inline edit of nutrients for the "corrected copy" branch.

## Proposed API

### Schema definition

Small zod-style DSL (no runtime dependency on zod — implement our own to stay dependency-free, or ship an adapter).

```ts
import { f, form } from 'uidetox/forms';

const IngredientSchema = f.object({
  name: f.string().min(2).max(200),
  category: f.enum(['vegetable', 'meat', 'dairy', /*...*/]),
  densityGml: f.number().positive().optional(),
  usdaFdcId: f.number().int().optional(),
  taste: f.object({
    saltiness: f.number().min(0).max(1),
    sweetness: f.number().min(0).max(1),
    // ...
  }),
  allergens: f.array(f.string()),
  dietTags: f.array(f.string()),
  nutrients: f.array(f.object({
    code: f.string(),
    amountPer100g: f.number().min(0),
  })).min(1),
});

type Ingredient = f.infer<typeof IngredientSchema>;
```

### Form instance in `ts script`

```ts script
import { form } from 'uidetox/forms';

const fm = form({
  schema: IngredientSchema,
  initial: props.initial ?? {
    name: '', category: 'vegetable', taste: { saltiness: 0, /*...*/ },
    allergens: [], dietTags: [], nutrients: [],
  },
  onSubmit: async (value) => {
    await apiClient.ingredients.create(value);
  },
});

// Reactive derived signals:
//   fm.values         : reactive proxy of current values
//   fm.errors         : reactive map<path, string[]>
//   fm.dirty          : reactive bool
//   fm.touched        : reactive map<path, bool>
//   fm.valid          : reactive bool (whole-form)
//   fm.submitting     : reactive bool
//   fm.field('name')  : returns { value, error, dirty, touched, setValue, setTouched, reset }

// Cross-field validation:
fm.rule(v => v.neto <= v.brutto, 'neto must not exceed brutto', ['neto']);

// Debounced side-effects (for similar-search):
fm.watch(['name', 'nutrients'], async (v) => {
  const hits = await apiClient.ingredients.findSimilar(v);
  similarSignal.value = hits;
}, { debounceMs: 300 });
```

### Template bindings

New attribute: `bind=${fm.field('...')}` binds value + error + touched.

```html
<form @submit=${fm.submit}>
  <input bind=${fm.field('name')} placeholder="Назва"/>
  <FieldError of=${fm.field('name')}/>

  <select bind=${fm.field('category')}>
    <for each=${categories} item="c">
      <option value=${c.code}>${c.label}</option>
    </for>
  </select>

  <fieldset>
    <legend>Смак</legend>
    <for each=${tasteAxes} item="ax">
      <label>
        ${ax.label}
        <input type="range" min="0" max="1" step="0.01"
               bind=${fm.field(`taste.${ax.code}`)}/>
      </label>
    </for>
  </fieldset>

  <ArrayField of=${fm.field('nutrients')} item="row" index="i">
    <input bind=${fm.field(`nutrients.${i}.code`)}/>
    <input type="number" bind=${fm.field(`nutrients.${i}.amountPer100g`)}/>
    <button type="button" @click=${() => fm.field('nutrients').removeAt(i)}>×</button>
  </ArrayField>
  <button type="button" @click=${() => fm.field('nutrients').append({ code: '', amountPer100g: 0 })}>
    + нутрієнт
  </button>

  <button type="submit" ?disabled=${!fm.valid || fm.submitting}>
    <if when=${fm.submitting}>Зберігаю…<else>Зберегти</else></if>
  </button>
</form>
```

### Required directives / components

- `<ArrayField>` — projects children per array item; exposes `item`, `index`, `first`, `last`, plus helpers `removeAt`, `moveTo` on the field handle.
- `<FieldError>` — renders the field's error text (nothing if pristine or valid). Reads reactively.
- `bind=${...}` attribute — sugar over two-way value + change listener + touched flag. Kind-detection uses the DOM element (`<input>` value, `<input type="checkbox">` checked, `<select>` value, `<input type="range">` numeric coercion).

### Async validation

Field-level async validators must be supported (name uniqueness check hits the backend).

```ts
name: f.string().min(2).asyncCheck(
  async (name) => (await api.ingredients.isNameFree(name)) || 'Ім\'я зайняте',
  { debounceMs: 400 }
),
```

While pending: `fm.field('name').pending === true`.

### Reset / dirty tracking

- `fm.reset(newInitial?)` — resets values (uses new initial if provided) and clears dirty/touched/errors.
- `fm.dirty` — true iff any value differs from initial (deep compare).
- Per-field: `fm.field(path).dirty`.

## Acceptance criteria

- [ ] Schema DSL supports: string, number, integer, boolean, enum, object, array, discriminated union (polymorphic operation params), optional, refine/asyncCheck.
- [ ] `form(...)` returns an object with reactive `values`, `errors`, `dirty`, `touched`, `valid`, `submitting`.
- [ ] `fm.field(path)` accepts dotted / bracketed path (`'nutrients.0.code'` or `'taste.saltiness'`).
- [ ] `bind=${fm.field(...)}` works on `<input type=text|number|range|checkbox|radio|date>`, `<textarea>`, `<select>`, and multi-select.
- [ ] `<ArrayField>` reorders / removes items without losing per-item bindings (keyed by identity, not index).
- [ ] Cross-field rules run on every relevant change.
- [ ] Async validators debounce and expose `pending`.
- [ ] Whole-form submit awaits async validators, then runs `onSubmit`. `submitting` reflects state.
- [ ] Test suite in `tests/forms/` covering: basic bindings, array add/remove/reorder, deep nested path, async validator race (last-write-wins), submit lifecycle, reset.
- [ ] Documentation page as an SFC example: `examples/forms/ingredient.md`.

## Out of scope for this request

- Wizard / multi-step forms (Culinary MVP does not need).
- Rich-text / WYSIWYG.
- File upload (deferred; Culinary uses generated placeholders in MVP).

## Open questions for you

1. Do we integrate this into runtime index exports (`uidetox/forms` sub-path) or ship as separate package?
2. Preferred schema DSL flavour: fluent (`f.string().min(2)`) or object literal (`{ type: 'string', min: 2 }`)? Fluent preferred by Culinary side.
3. Path syntax — dotted string vs typed helper `fm.field(v => v.nutrients[0].code)`? Typed helper is nicer but harder to implement; dotted string is fine for MVP.
