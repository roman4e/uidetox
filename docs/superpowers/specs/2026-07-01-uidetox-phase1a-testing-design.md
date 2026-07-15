# UIDetox Phase 1a — Testing Infrastructure Design Spec

**Status:** Draft (v0.1)
**Date:** 2026-07-01
**Depends on:** `2026-07-01-uidetox-design.md` (framework spec), Phase 0 MVP (already implemented).
**Owner:** roman4e@gmail.com

## 1. Purpose

Give every UIDetox component the ability to carry its tests, fixtures, mocks, structural snapshots, pixel-diff snapshots and accessibility assertions in the same `.md` file — and let those tests run through a single `uidetox test` CLI. Testing is the framework's headline DNA; this phase makes that DNA real.

## 2. Non-goals (Phase 1a)

- No `example`, `example:setup`, `changelog` blocks — Phase 1b.
- No traits mechanism — Phase 1c.
- No DevTools browser extension — Phase 1d.

## 3. New Fenced Block Roles

| Fence header | Role | Runs in | Purpose |
|---|---|---|---|
| `json fixtures` | Fixture data | shared, all test blocks | Named data records reused across tests / previews. |
| `ts mock` | Registry / module overrides | shared, before each test | Redirect Registry tokens and module imports to test doubles. |
| `ts test` | Unit test | happy-dom | Assert DOM after props + interaction. |
| `ts test:interaction` | User-interaction | happy-dom | Higher-fidelity click / type / press sequences. |
| `ts test:visual` | Structural DOM snapshot | happy-dom | Serialized DOM tree compared to stored baseline. |
| `ts test:visual:pixel` | Pixel-diff snapshot | Playwright (Chromium) | Screenshot compared to PNG baseline. |
| `ts test:a11y` | Runtime a11y | happy-dom + axe-core | Fast, breadth-first accessibility checks. |
| `ts test:a11y:browser` | Full a11y | Playwright + axe-core | Real-browser semantics, focus order, high-contrast. |

Blocks share the compilation-time scope of the component's `ts script` block (`state`, handlers). Test-block-only imports (`expect`, `it`, `describe`, `snapshot`, `pixel`, `axe`, `flushSync`) are injected automatically at compile time — the author does not import them.

## 4. Test Author Experience — Concrete Example

````md
---
name: Todo
tag: app-todo
---

```ts props
export type Props = { id: string; title: string; done: boolean };
```

```html template
<li class="todo" data-done=${props.done}>
  <input type="checkbox" checked=${props.done} @change=${toggle}/>
  <span>${props.title}</span>
</li>
```

```ts script
function toggle() { emit('toggle', { id: props.id }); }
```

```json fixtures
{
  "default": { "id": "1", "title": "Buy milk", "done": false },
  "completed": { "id": "2", "title": "Ship v1",  "done": true  }
}
```

```ts mock
// swap the api token used by any child that reads it
registry.override(apiToken, { updateTodo: () => Promise.resolve() });
```

```ts test
it('renders the title text', () => {
  document.body.innerHTML = `<app-todo id="1" title="X" done="false"></app-todo>`;
  const el = document.body.querySelector('app-todo')!;
  expect(el.querySelector('span')?.textContent).toBe('X');
});

it('emits toggle on checkbox change', async () => {
  document.body.innerHTML = `<app-todo id="1" title="X" done="false"></app-todo>`;
  const el = document.body.querySelector('app-todo')!;
  const events = capture(el, 'toggle');
  el.querySelector('input')!.click();
  await flushSync();
  expect(events).toEqual([{ id: '1' }]);
});
```

```ts test:visual
snapshot('default', fixtures.default);
snapshot('completed', fixtures.completed);
```

```ts test:visual:pixel
pixel('default', fixtures.default, { viewport: { width: 320, height: 200 } });
pixel('completed-dark', fixtures.completed, { theme: 'dark' });
```

```ts test:a11y
document.body.innerHTML = `<app-todo id="1" title="X" done="false"></app-todo>`;
expect(await axe(document.body)).toHaveNoViolations();
```
````

## 5. Architecture

### 5.1 Layers

- **Compiler layer (build-time).** New passes in `src/compiler/` locate test-role blocks, emit **two** module outputs per SFC:
  1. Production module (unchanged from Phase 0) — templates, script, style.
  2. Test module (`.test.js`) — component boot + fixtures + mock + all `test*` blocks wrapped in the test-runner harness.
- **Runtime layer (execution-time).** New package `src/testing/` supplies the injected globals (`expect`, `it`, `snapshot`, `axe`, `pixel`, `capture`, `flushSync`), the Registry (hierarchical, moved forward from Phase 2), and `defineEmits()` for the component runtime.
- **Runner layer.** `uidetox test <dir>` scans SFCs, compiles their test modules to a cache directory (`.uidetox/test-cache/`), and executes them through the right environment for each block role.

### 5.2 Environments

| Environment | Blocks it runs |
|---|---|
| **happy-dom** (in-process, fast) | `test`, `test:interaction`, `test:visual`, `test:a11y`, plus `fixtures` + `mock` shared preamble. |
| **Playwright + Chromium** (spawned) | `test:visual:pixel`, `test:a11y:browser`. |

The runner batches blocks by environment: it starts one happy-dom pass for all fast blocks, then one Playwright pass for the pixel + browser-a11y blocks. Batching keeps the browser spin-up cost amortised.

### 5.3 Compilation Output — Test Module Skeleton

For `todo.md` the test compiler emits `todo.test.js`:

```js
import { defineComponent, __el, /* ... */, registry } from 'ui-detox';
import { it, describe, expect, snapshot, pixel, axe, flushSync, capture, fixtures as $fixtures } from 'ui-detox/testing';
// component boot (identical to prod)
function boot(ctx) { /* script + template inlined */ }
defineComponent({ tag: 'app-todo', props: [...], boot });
// fixtures
const fixtures = { default: {...}, completed: {...} };
// mocks — hoisted so they run before every it()
function __applyMocks() { registry.override(apiToken, {...}); }
// blocks
describe('todo (test)',       () => { __applyMocks(); /* test block body */ });
describe('todo (interaction)',() => { __applyMocks(); /* test:interaction body */ });
describe('todo (visual)',     () => { __applyMocks(); /* test:visual body */ });
// blocks that need Playwright are extracted separately (see 5.4)
```

Blocks that require Playwright (`test:visual:pixel`, `test:a11y:browser`) are emitted into a sibling `todo.browser.test.js` module — the runner routes it accordingly.

### 5.4 Runner

```
uidetox test <dir> [--filter <pattern>] [--update-snapshots] [--only <role>]
```

Steps:

1. Walk `<dir>` for `*.md`, parse SFCs.
2. For each SFC that has any `test*` block, run the test compiler → cache `.uidetox/test-cache/<rel>.test.js` and optionally `<rel>.browser.test.js`.
3. Group files:
   - **Group A** — happy-dom modules. Run in-process; each module gets a fresh `happy-dom` window (`Registry` re-provided per module, mocks applied per block).
   - **Group B** — Playwright modules. Spawn Chromium once, page-per-module; serve a lightweight harness page from the runner that imports the test module.
4. Collect results, print summary. Non-zero exit if failures.

## 6. Runtime Additions

### 6.1 `defineEmits<T>()` — component-emitted events

```ts
// inside ts script:
const emit = defineEmits<{ toggle: { id: string }; open: void }>();
emit('toggle', { id: props.id });
```

Implementation:

- `defineEmits()` returns an `emit(name, detail?)` function bound to the current host element.
- Under the hood it calls `host.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))`.
- Registered event names are collected at compile time from the type parameter (best-effort; runtime falls back to accepting any string).

### 6.2 Registry (moved forward from Phase 2)

Full hierarchical Registry. Three scopes:

- **Global** — provided at bootstrap, seen everywhere.
- **Module** — created per module (compiled `routes.md` / plugin) or explicitly via `createRegistryScope()`.
- **Local override** — `registry.override(token, value)` inside a test bundle replaces the value for the duration of the running module.

Resolution order: local → module → global; first match wins.

Values may be plain or reactive. `registry.get(token)` returns a `Derived<T>` whose `.value` re-evaluates as the provider changes.

### 6.3 `capture(host, eventName)` — test helper

```ts
const events = capture(el, 'toggle');
// ... interact ...
expect(events).toEqual([{ id: '1' }]);
```

Attaches a listener that pushes `event.detail` into an array; returns the array.

## 7. Testing Utilities

- **`expect`** — minimal matcher set (`toBe`, `toEqual`, `toContain`, `toBeTruthy`, `toBeFalsy`, `toBeNull`, `toBeUndefined`, `toHaveLength`, `toHaveNoViolations`, `toMatchSnapshot`). Not a full clone of Vitest; enough for MVP.
- **`it` / `describe`** — collectors that push into the current test-module registry, executed by the runner (not by Vitest).
- **`snapshot(name, props?)`** — structural DOM snapshot. Serializes the currently-mounted subtree (from `document.body`) and compares to `snapshots/<component>/<name>.snap`.
- **`pixel(name, props?, opts?)`** — records a screenshot via Playwright and pixel-diffs against `snapshots/<component>/<name>.png` using `pixelmatch`.
- **`axe(root)`** — runs `axe-core` against the given root; returns a result object with `violations`.
- **`flushSync`** — re-exported from the runtime scheduler.

## 8. CLI

### 8.1 Commands

- `uidetox test <dir>` — run all tests under a directory.
- `uidetox test <dir> --filter <pattern>` — glob-filter by SFC name.
- `uidetox test <dir> --only <role>` — run only blocks of a specific role (e.g. `--only test:visual`).
- `uidetox test <dir> --update-snapshots` — write missing baselines / accept new ones.

### 8.2 Output

Human-readable colored summary:

```
✔ todo.md         test (2)         56ms
✔ todo.md         visual (2)       120ms
✖ todo.md         a11y (1)         48ms
  · document has no lang attribute
✔ card.md         test (3)         73ms

3 files, 8 blocks, 7 passed, 1 failed
```

Machine-readable JSON via `--reporter=json`.

## 9. File Layout

```
src/
  compiler/
    testCompile.ts          # per-SFC test-module emitter
    testExtract.ts          # collects test-role blocks, hoists fixtures/mocks
  runtime/
    emits.ts                # defineEmits()
    registry.ts             # hierarchical Registry + createToken
  testing/
    index.ts                # public re-exports for the injected globals
    describe.ts             # it/describe collectors + runner interface
    expect.ts               # matcher module
    capture.ts              # capture()
    snapshot/
      structural.ts         # snapshot() implementation + serializer
      pixel.ts              # pixel() driver (Playwright side)
    a11y/
      runtime.ts            # axe() for happy-dom
      browser.ts            # axe() for Playwright
  cli/
    test.ts                 # uidetox test command
    testRunner/
      happyDomEnv.ts        # in-process env harness
      playwrightEnv.ts      # spawn + drive Playwright
      collect.ts            # discover *.md → compile → cache
      report.ts             # human + JSON reporters
tests/
  testing/                  # unit tests for each testing utility
  cli/
    test-command.test.ts    # runs a fixture SFC through the runner
snapshots/                  # generated snapshot baselines (per component subdir)
```

## 10. Compatibility

- Existing Phase 0 CLI (`uidetox build`) unchanged.
- Existing Phase 0 runtime API unchanged.
- Existing Phase 0 Vitest suite under `tests/` remains the framework's own test harness (dogfooding is a Phase 2 nice-to-have, out of scope now).

## 11. Rendering-Mode Interaction (deferred)

Static prerender modes from the framework spec Section 9 do not participate in Phase 1a — tests always render live. `test:visual` compares to structural baselines; `test:visual:pixel` compares to screenshot baselines. Static-cache-vs-hydrated verification is Phase 2.

## 12. Open Questions

- Whether the runner should live in Node's built-in test runner (`node:test`) or be hand-rolled. Current plan is hand-rolled — small footprint, tight integration with UIDetox compilation. Node's runner may be adopted later if collectors become interoperable.
- Playwright launch config — bundled Chromium via `playwright install chromium`, or a user-provided binary? MVP: `playwright install chromium` on first run; the runner reports install progress.
- How to represent flaky-pixel tolerance across CI vs local. MVP: fixed `threshold: 0.1` per test; per-test override is deferred.
- Test isolation between blocks — MVP resets `document.body.innerHTML = ''` before each `it()`; heavier isolation (fresh `Window`) deferred.
