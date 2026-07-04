# UIDetox Phase 4a — Section-Based DSL Grammar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) tracking.

**Goal:** Migrate the dtx DSL to line-based section members (`tpl … end tpl`) with optional `end`, add `declare`, flip imports to JS style, distinguish `script` (private) vs `actions` (host methods), and add a `detox.toml` resolver.

**Architecture:** New `lines.ts` line scanner splits a declaration into a header line + members; section members capture raw bodies until the next keyword/`end`/EOF, signature members reuse the existing tokenizer's brace-balanced parse. Emitter flips imports and wires actions to `host`. A `resolve.ts` loads `detox.toml` and resolves bare `import` names.

**Tech Stack:** TypeScript 5.x, `smol-toml`.

## Global Constraints

- Section keywords: `props tpl template script actions effects style`. Signature keywords: `on off transform default`. Verb keywords: `component trait filter token provide router`. Plus `declare import end`.
- `tpl` == `template`. A keyword terminates a section body only when it is the first word of a line.
- `end <name>` optional; next keyword auto-closes.
- Imports: `import <names> [from <path>]`; `from X import Y` removed.
- `script` → private boot statements; `actions` → functions attached to `host`.
- Config: `detox.toml` primary, `detox.json` fallback.
- TDD; migrate existing dtx tests in-place.

---

## Task 1: Add smol-toml

- [ ] Add `"smol-toml": "^1.3.0"` to `package.json` dependencies; `pnpm install`; `pnpm test` (existing green).
- [ ] Commit `chore: add smol-toml for detox config`.

## Task 2: Line scanner `lines.ts`

- [ ] Test `tests/compiler/dtx/lines.test.ts`: `scanDeclaration` splits a component into header + section/signature member chunks with raw bodies and auto-close.
- [ ] Implement `src/compiler/dtx/lines.ts`:
  - `firstWord(line)`, keyword sets.
  - `scanSource(source): { imports: string[]; blocks: RawBlock[] }` where `RawBlock = { header: string; members: RawMember[]; verb: string; }` and `RawMember` is `{ kind: 'section'|'signature'|'property'|'import'; keyword: string; header: string; body: string; scoped?: boolean }`.
  - Section body captured until next keyword line / `end <kw>` / EOF.
  - Signature member captured by brace-balancing `{ }` across lines.
- [ ] Commit.

## Task 3: Types + parser integration

- [ ] Extend `Member.kind` with `'template'|'style'|'script'|'actions'|'effects'|'props'` (section kinds already partially present); add `Declaration.isDeclare?: boolean`.
- [ ] Rewrite `parse.ts` to: scan via `lines.ts`, tokenize each header for verb+name+clauses (reuse existing clause tokenizer), parse signature members via existing token logic, attach section members with raw bodies.
- [ ] Flip import parsing to `import <names> [from <path>]`.
- [ ] Migrate `tests/compiler/dtx/parse.test.ts` + `inherit-parse.test.ts` + `component-parse.test.ts` to new syntax.
- [ ] Commit.

## Task 4: `declare` top-level

- [ ] Test: `declare tpl card-header … end tpl` parses to a declare block.
- [ ] Implement in `lines.ts` + `parse.ts`: `declare <kind> <name>` yields a Declaration with `isDeclare=true`, verb=the member kind.
- [ ] Commit.

## Task 5: Emitter — import flip + declare

- [ ] Update `emit.ts` `emitImport` for `import <names> from <path>` shape (still lowers to `import { … } from …`).
- [ ] Emit declares as exported constants/registries as applicable (tpl → a factory fn; style → a string; props → a schema object; script → a function).
- [ ] Migrate `inherit-emit.test.ts` import expectations.
- [ ] Commit.

## Task 6: Component emit from sections + actions→host

- [ ] Rewrite `component.ts`: read section members (`tpl`/`template`, `script`, `actions`, `effects`, `style`, `props`), build boot: script statements, template into `__tpl`, effects, then for each `function <name>` in `actions` emit `host.<name> = <name>;`, return `__tpl`.
- [ ] Test `component-emit.test.ts` migrated: expects `host.inc = inc;` wiring and section-sourced template/style.
- [ ] Commit.

## Task 7: Resolver + detox config

- [ ] Test `resolve.test.ts`: `loadConfig(dir)` reads `detox.toml` then `detox.json`; `resolveImport(name, fromDir, config)` finds `<name>.dtx`/`.md` in fromDir/cwd/includes.
- [ ] Implement `src/compiler/dtx/resolve.ts`.
- [ ] Commit.

## Task 8: Migrate examples + E2E

- [ ] Rewrite `examples/dsl/components/AppCard.dtx`, `examples/showcase/traits/inputs.dtx`, `examples/showcase/filters/text.dtx` to new syntax (traits/filters mostly unchanged except imports).
- [ ] E2E `tests/e2e/dtx-sections.test.ts`: compile a full section-based component; assert defineComponent + host action wiring + template.
- [ ] Full `pnpm test` green.
- [ ] Commit.

## Self-Review

- Spec §2 member kinds → Tasks 2/3. §3 levels → Tasks 3/4. §5 declare → Tasks 4/5. §6 script/actions → Task 6. §7 imports → Tasks 3/5. §8 resolver → Task 7. §9 example → Task 8.
