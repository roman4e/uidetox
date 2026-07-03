# UIDetox Phase 2e — component DSL Verb Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `component <Name>` as a fifth DSL verb — parses sub-block members (`template { ... }`, `style { ... }`, `actions { ... }`) and clauses (`tag`, `props`, `state`, `export`, `extends`) and emits a `defineComponent({ tag, props, boot, style })` call that reuses Phase 0's template codegen.

**Architecture:** Extend `Verb` union with `'component'`. Extend the DSL tokenizer to recognise `template`, `style`, `actions`, `effects` as sub-block member starts; each sub-block owns a brace-balanced TS/HTML/CSS body. A new `src/compiler/dtx/component.ts` module owns the component-specific emit, delegating template body through the existing `parseTemplate → transformDirectives → codegen` pipeline.

**Tech Stack:** TypeScript 5.x. No new dependencies.

## Global Constraints

- Component **name** is PascalCase (JS identifier); `tag` clause holds the kebab-case Custom Element tag.
- Sub-blocks are literal string bodies (not sub-declarations); the tokenizer emits them as `body` tokens per the existing `{ … }` handling.
- Sub-block order is free; only one of each per component.
- The emit call is `defineComponent({ tag, props: [<observed-attrs>], boot: (ctx) => <template-node>, style?: <css-string> })`.
- `actions` sub-block content is spliced into `boot` prior to the template body, so its declarations are in scope.
- Test discipline: TDD. One deliverable per task, one commit per task.

---

## File Structure

```
src/compiler/dtx/
  types.ts               # MODIFIED — Verb widened
  parse.ts               # MODIFIED — parse component verb + sub-block members
  emit.ts                # MODIFIED — dispatch component verb to component.ts
  component.ts           # NEW — emit defineComponent
tests/compiler/dtx/
  component-parse.test.ts
  component-emit.test.ts
tests/e2e/
  dtx-component-basic.test.ts
examples/dsl/components/
  AppCard.dtx
```

---

## Task 1: Widen `Verb` + accept `component` at parseDeclaration

**Files:**
- Modify: `src/compiler/dtx/types.ts`, `src/compiler/dtx/parse.ts`

**Interfaces:**
- Widen: `type Verb = 'trait' | 'filter' | 'token' | 'provide' | 'component';`
- Parser accepts `component <Name>` (name may be PascalCase).

- [ ] **Step 1: Widen types**

Edit `src/compiler/dtx/types.ts` — change:
```ts
export type Verb = 'trait' | 'filter' | 'token' | 'provide' | 'component';
```

- [ ] **Step 2: Extend VERBS set**

Edit `src/compiler/dtx/parse.ts` — change the module-level set:
```ts
const VERBS = new Set<Verb>(['trait', 'filter', 'token', 'provide', 'component']);
```

- [ ] **Step 3: Verify existing tests still pass**

Run: `pnpm test tests/compiler/dtx`
Expected: PASS (existing tests untouched).

- [ ] **Step 4: Commit**

```bash
git add src/compiler/dtx/types.ts src/compiler/dtx/parse.ts
git commit -m "feat(dtx): widen Verb with 'component'"
```

---

## Task 2: Sub-block members — `template { … }`, `style { … }`, `actions { … }`

**Files:**
- Modify: `src/compiler/dtx/parse.ts`, `src/compiler/dtx/types.ts`
- Test: `tests/compiler/dtx/component-parse.test.ts`

**Interfaces:**
- Extend `Member.kind` union with `'template' | 'style' | 'actions' | 'effects'`.
- Sub-block grammar: `<name> [scoped] { <body> }` — body is a `body` token (balanced-brace text), name resolves to member kind. `scoped` flag captured only for `style`.

- [ ] **Step 1: Extend types**

Edit `src/compiler/dtx/types.ts` — Member.kind union becomes:
```ts
export interface Member {
  kind: 'on' | 'transform' | 'default' | 'prop' | 'off' | 'template' | 'style' | 'actions' | 'effects';
  event?: string;
  name: string | null;
  body?: string;
  propValue?: string;
  scoped?: boolean;
}
```

- [ ] **Step 2: Write failing test**

Write `tests/compiler/dtx/component-parse.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseDtx } from '../../../src/compiler/dtx/parse.js';

describe('parse component', () => {
  it('parses component with sub-blocks', () => {
    const src = `component AppCard tag "app-card"
template { <div>x</div> }
style scoped { .card { padding: 1rem; } }
actions { function onClick() { console.log('c'); } }
`;
    const ast = parseDtx(src);
    const decl = ast.declarations[0];
    expect(decl.verb).toBe('component');
    expect(decl.name).toBe('AppCard');
    expect(decl.clauses.find((c) => c.key === 'tag')?.value).toBe('app-card');
    const tpl = decl.members.find((m) => m.kind === 'template');
    expect(tpl?.body).toContain('<div>x</div>');
    const style = decl.members.find((m) => m.kind === 'style');
    expect(style?.scoped).toBe(true);
    expect(style?.body).toContain('.card { padding: 1rem; }');
    const actions = decl.members.find((m) => m.kind === 'actions');
    expect(actions?.body).toContain("console.log('c')");
  });
});
```

- [ ] **Step 3: Verify fail**

Run: `pnpm test tests/compiler/dtx/component-parse.test.ts`
Expected: FAIL.

- [ ] **Step 4: Extend `isMemberStart` and add `parseSubBlock`**

Edit `src/compiler/dtx/parse.ts`:

Extend `isMemberStart()`:
```ts
    if (t.kind === 'word' && (
      t.value === 'on' || t.value === 'off' || t.value === 'transform' || t.value === 'default' ||
      t.value === 'template' || t.value === 'style' || t.value === 'actions' || t.value === 'effects'
    )) return true;
```

Extend `parseMember()` — add sub-block handling after existing branches (before final `return null;`):
```ts
    if (t.kind === 'word' && (t.value === 'template' || t.value === 'style' || t.value === 'actions' || t.value === 'effects')) {
      const kind = t.value as 'template' | 'style' | 'actions' | 'effects';
      this.i++;
      let scoped = false;
      const nextTok = this.peek();
      if (nextTok && nextTok.kind === 'word' && nextTok.value === 'scoped') { scoped = true; this.i++; }
      const bodyTok = this.next();
      if (bodyTok.kind !== 'body') throw new Error(`{ body } expected after ${kind}`);
      return { kind, name: null, body: bodyTok.value, scoped };
    }
```

Also allow the parser to accept a `tag` clause with a `string`-token value (currently the value branch only accepts `word`). Extend the value-branch in `parseClauses`:
```ts
      if (nextTok.kind === 'string') {
        this.i++;
        clauses.push({ key, kind: 'value', value: nextTok.value });
        continue;
      }
```
Place this new check **before** the existing `nextTok.kind === 'word'` value-branch.

- [ ] **Step 5: Verify pass**

Run: `pnpm test tests/compiler/dtx/component-parse.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/compiler/dtx/parse.ts src/compiler/dtx/types.ts tests/compiler/dtx/component-parse.test.ts
git commit -m "feat(dtx): parse component sub-blocks (template/style/actions/effects) + string tag"
```

---

## Task 3: Component emit — `defineComponent({ tag, props, boot, style })`

**Files:**
- Create: `src/compiler/dtx/component.ts`
- Modify: `src/compiler/dtx/emit.ts` — dispatch `component` verb to `component.ts`
- Test: `tests/compiler/dtx/component-emit.test.ts`

**Interfaces:**
- Consumes: `parseTemplate`, `transformDirectives`, `codegen` (from Phase 0), `Declaration`, `Member`.
- Produces `emitComponent(decl: Declaration): string`.

- [ ] **Step 1: Write failing test**

Write `tests/compiler/dtx/component-emit.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { compileDtx } from '../../../src/compiler/dtx/index.js';

describe('component emit', () => {
  it('emits defineComponent call with template + style', () => {
    const src = `component AppCard export tag "app-card"
template { <div class="card"><h2>${'${props.title}'}</h2></div> }
style scoped { .card { padding: 1rem; } }
`;
    const { code } = compileDtx(src);
    expect(code).toContain("import { defineComponent");
    expect(code).toContain("export const AppCard = defineComponent({");
    expect(code).toContain("tag: 'app-card'");
    expect(code).toContain("__el('div'");
    expect(code).toContain(".card { padding: 1rem; }");
  });

  it('splices actions body into boot before template', () => {
    const src = `component X tag "x-x"
actions { const greeting = 'hi'; }
template { <div>${'${greeting}'}</div> }
`;
    const { code } = compileDtx(src);
    expect(code).toContain("const greeting = 'hi';");
    expect(code).toContain("() => (greeting)");
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `pnpm test tests/compiler/dtx/component-emit.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `component.ts`**

Write `src/compiler/dtx/component.ts`:
```ts
import { parseTemplate } from '../template/parse.js';
import { transformDirectives } from '../template/transform.js';
import { codegen } from '../template/codegen.js';
import type { Declaration, Member } from './types.js';

function sq(v: string): string { return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`; }

function propNames(decl: Declaration): string[] {
  const clause = decl.clauses.find((c) => c.key === 'props');
  if (!clause?.params) return [];
  return clause.params.map((p) => p.name);
}

export function emitComponent(decl: Declaration): string {
  const tagClause = decl.clauses.find((c) => c.key === 'tag');
  const tag = tagClause?.value ?? decl.name.toLowerCase();
  const isExport = decl.clauses.some((c) => c.key === 'export');
  const template = decl.members.find((m) => m.kind === 'template');
  const style = decl.members.find((m) => m.kind === 'style');
  const actions = decl.members.find((m) => m.kind === 'actions');
  const effects = decl.members.find((m) => m.kind === 'effects');

  const templateSource = template?.body ?? '<div/>';
  const ast = transformDirectives(parseTemplate(templateSource));
  const templateBody = codegen(ast);

  const bootLines: string[] = [
    '  const { props, host } = ctx;',
  ];
  if (actions?.body) bootLines.push(`  ${actions.body.trim()}`);
  if (effects?.body) bootLines.push(`  ${effects.body.trim()}`);
  bootLines.push(`  return ${templateBody};`);

  const styleField = style ? `,\n  style: ${sq(style.body ?? '')}` : '';
  return `${isExport ? 'export ' : ''}const ${decl.name} = defineComponent({
  tag: ${sq(tag)},
  props: ${JSON.stringify(propNames(decl))},
  boot: (ctx) => {
${bootLines.join('\n')}
  }${styleField}
});
`;
}
```

- [ ] **Step 4: Wire into `emit.ts` + runtime import**

Edit `src/compiler/dtx/emit.ts`:

Add near top:
```ts
import { emitComponent } from './component.js';
```

In `collectImports`:
```ts
    if (decl.verb === 'component') { needed.add('defineComponent'); needed.add('__el'); needed.add('__text'); needed.add('__bind'); }
```

In `emitDtx` dispatch:
```ts
    else if (decl.verb === 'component') lines.push(emitComponent(decl));
```

- [ ] **Step 5: Verify pass**

Run: `pnpm test tests/compiler/dtx/component-emit.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/compiler/dtx/component.ts src/compiler/dtx/emit.ts tests/compiler/dtx/component-emit.test.ts
git commit -m "feat(dtx): emit defineComponent from component verb"
```

---

## Task 4: E2E — component DSL

**Files:**
- Create: `examples/dsl/components/AppCard.dtx`
- Test: `tests/e2e/dtx-component-basic.test.ts`

- [ ] **Step 1: Create example**

Write `examples/dsl/components/AppCard.dtx`:
```dtx
component AppCard export tag "app-card"
template { <div class="card"><slot/></div> }
style scoped { .card { padding: 1rem; } }
```

- [ ] **Step 2: Write E2E test**

Write `tests/e2e/dtx-component-basic.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileDtx } from '../../src/compiler/dtx/index.js';

describe('dtx component e2e', () => {
  it('compiles AppCard.dtx to defineComponent module', () => {
    const src = readFileSync(join(process.cwd(), 'examples/dsl/components/AppCard.dtx'), 'utf8');
    const { code } = compileDtx(src);
    expect(code).toContain("export const AppCard = defineComponent({");
    expect(code).toContain("tag: 'app-card'");
    expect(code).toContain("__el('div'");
    expect(code).toContain("padding: 1rem");
  });
});
```

- [ ] **Step 3: Verify pass**

Run: `pnpm test tests/e2e/dtx-component-basic.test.ts`
Expected: PASS.

- [ ] **Step 4: Run whole suite**

Run: `pnpm test`
Expected: every test passes.

- [ ] **Step 5: Commit**

```bash
git add examples/dsl/components tests/e2e/dtx-component-basic.test.ts
git commit -m "test(e2e): dtx component basic — AppCard emits defineComponent"
```

---

## Self-Review Notes

- **Spec coverage:**
  - §3 grammar → Tasks 1, 2, 3.
  - §4 emit shape → Task 3.
  - §5 file layout → matches tasks.
- **Deferred (spec §7):**
  - `test { … }` sub-block — not tasked.
  - Full PageMetadata validation for DSL components — Phase 1b.
  - Source-map offsets for sub-blocks — future.
- **Placeholder scan:** every step has concrete code.
- **Type consistency:** `Verb`, `Member.kind`, `emitComponent` used consistently.
