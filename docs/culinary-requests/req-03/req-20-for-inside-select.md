# REQ-20 — `<for>` (and other control-flow elements) inside `<select>` are dropped by the HTML5 parser

**Priority:** **P1** — every `<select>` populated dynamically from a reactive
list is broken. Culinary's `RecipeCompare` page cannot render its
"select A / select B" version pickers without a workaround.

**Follows:** REQ-19 (which fixed `<if>/<for>/<case>` teardown but did not
touch the parser's HTML5 fragment context handling).

## Symptom

Template:

```html
<select .value=${sel.a ?? ""} @change=${(e) => (sel.a = e.target.value || null)}>
  <option value="">— виберіть —</option>
  <for each=${versions.data} item="ver" key="ver.id">
    <option value=${ver.id}>v${ver.version_no}.${ver.revision} — ${ver.title ?? "без назви"}</option>
  </for>
</select>
```

Runtime error:

```
Uncaught ReferenceError: ver is not defined
```

Rendered DOM (no options past the placeholder, `<for>` gone):

```html
<select>
  <option value="">— виберіть —</option>
</select>
```

Renaming the loop variable to any other identifier does not help.
`refs` on the `<select>` + effect that assigns `innerHTML` works but is a
hack.

## Root cause

`src/compiler/template/parse.ts` uses `parse5.parseFragment(masked)` with
the **default fragment context** (i.e. `<template>`). The HTML5 tokenizer
under the default fragment context allows any children.

BUT the runtime template is also mounted into a real DOM `<select>`
element, whose "in select" insertion mode strips any child that is not
`<option>`, `<optgroup>`, or `<hr>`. Anything else — including
`<for>` — is silently discarded before UIDetox's directive walker sees
it. What remains is a `<option value=${ver.id}>…</option>` whose
`ver` expression has no lexical binding, hence the `ver is not defined`
throw at first render.

The same class of restriction applies to `<table>` (`<tbody>` only
accepts `<tr>`), `<ul>` (accepts `<li>` and flow content, more lenient),
`<colgroup>`, `<datalist>`, and `<optgroup>`. `RecipeCompare` also uses
`<for>` inside `<tbody>` which appears to work — likely because `<tr>` is
the sole child, but the same mechanism could break as soon as the loop
variable is used in an attribute expression on a `<tr>`.

## What UIDetox needs to do

Two layers of fix are required — one at the compiler, one at the
runtime mounter.

### 20a — compiler: transform `<for>/<if>/<case>` into inert placeholder elements before HTML parsing

Rewrite the source pre-parse so parse5 sees only allowed content, then
lift back to control-flow nodes in the AST pass. Options:

- Replace `<for …>…</for>` with `<template data-uidx-for="…">…</template>`
  (browsers ignore `<template>` when inside a `<select>`; parse5 keeps it
  as a `TemplateElement` node whose `content` DocumentFragment holds the
  children). Then the AST transform reads `data-uidx-for` back off and
  emits a `TplNode` of type `for`.
- Same for `<if>` and `<case>/<when>`.

The `<template>` trick already works in browsers for the "insert
arbitrary child inside a `<select>`" case — it's the canonical HTML5
workaround.

### 20b — runtime mount: mount into a detached fragment first when the parent is a restricted-content element

If the compiled template is mounted via `element.appendChild(node)` on a
`<select>`, `<table>`, `<tbody>`, `<colgroup>`, `<datalist>`, or
`<optgroup>`, the DOM will still reject non-conforming children.
Runtime should build the subtree in a `<template>.content`
DocumentFragment (which does not enforce parent-child rules) and then
`insertBefore` the individual conforming children into the real parent.
This matches how frameworks like Lit render into `<select>` bodies.

## Regression tests

```ts
// 20a — compiler:
const ast = compileTemplate(`
  <select>
    <option value="">--</option>
    <for each=\${items} item="it" key="it.id">
      <option value=\${it.id}>\${it.label}</option>
    </for>
  </select>
`);
// Expect: ast <select> has children: option, for(item="it", key="it.id", body=[option])
// NOT: ast <select> has children: option, option(broken, `it` unbound)

// 20b — runtime:
const state = state({ items: [{id: 1, label: 'a'}, {id: 2, label: 'b'}] });
mount(<Comp />, host);
expect(host.querySelectorAll('select > option').length).toBe(3);
// (1 placeholder + 2 from the loop)
state.items = [{id: 3, label: 'c'}];
expect(host.querySelectorAll('select > option').length).toBe(2);
```

## Culinary side after this lands

- Revert `RecipeCompare.dtx` to `<for each=${versions.data} item="ver" key="ver.id">`.
- Delete the `refs.selA`/`refs.selB` + `innerHTML` effect workaround.
- Add the same `<for>` pattern to any `<table>` list rendering when
  variables in `<tr>` attribute expressions are needed.

## What Culinary is doing right now

Waiting on REQ-20. `RecipeCompare` is currently reverted to the
canonical `<for>` template (per the "no framework hacks" rule) which
means the page is broken in prod (empty selects). Users can't diff
versions until REQ-20 lands.
