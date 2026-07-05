import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileDtx } from '../../../src/compiler/dtx/index.js';
import { resolveSpecifier } from '../../../src/compiler/dtx/resolve.js';

describe('dtx import syntax', () => {
  it('named import (something ≡ { something }) resolves a dotted path to .js', () => {
    const { code } = compileDtx('import Card from "components.card"\n');
    expect(code).toContain('import { Card } from "./components/card.js";');
  });

  it('multiple names', () => {
    const { code } = compileDtx('import Card, Panel from "ui.widgets"\n');
    expect(code).toContain('import { Card, Panel } from "./ui/widgets.js";');
  });

  it('namespace import: import * as Name', () => {
    const { code } = compileDtx('import * as Utils from "lib.util"\n');
    expect(code).toContain('import * as Utils from "./lib/util.js";');
  });

  it('a specifier containing "/" is passed through verbatim (npm/explicit)', () => {
    const { code } = compileDtx('import form, f from "uidetox/forms"\n');
    expect(code).toContain('import { form, f } from "uidetox/forms";');
  });

  it('side-effect import of a dotted local ref resolves to a compiled path', () => {
    const { code } = compileDtx('import widgets.my-widget\n');
    expect(code).toContain('import "./widgets/my-widget.js";');
  });

  it('leaves a bare npm specifier verbatim (REQ-14.1)', () => {
    const { code } = compileDtx('import registry from "uidetox"\nimport authToken from "tokens"\n');
    expect(code).toContain('import { registry } from "uidetox";');   // bare npm, not ./uidetox.js
    // `tokens` has no on-disk match without baseDir → treated as bare (bundler resolves)
    expect(code).toContain('import { authToken } from "tokens";');
  });

  it('emits all strings in double quotes', () => {
    const { code } = compileDtx('component AppCard tag app-card\ntemplate\n<div class="card"><slot/></div>\nend template\nend component\n');
    expect(code).toContain('import { defineComponent } from "uidetox";');
    expect(code).toContain('tag: "app-card"');
    expect(code).not.toMatch(/from 'uidetox'/);
    expect(code).not.toMatch(/tag: 'app-card'/);
  });
});

describe('resolveSpecifier (filesystem, Python-style)', () => {
  it('picks <path>.dtx beside the importer, else <path>/module.dtx, else includes', () => {
    const root = mkdtempSync(join(tmpdir(), 'dtx-res-'));
    const inc = mkdtempSync(join(tmpdir(), 'dtx-inc-'));
    // beside: foo.dtx
    writeFileSync(join(root, 'foo.dtx'), '');
    // package form: bar/module.dtx
    mkdirSync(join(root, 'bar'), { recursive: true });
    writeFileSync(join(root, 'bar', 'module.dtx'), '');
    // include root: shared.dtx
    writeFileSync(join(inc, 'shared.dtx'), '');

    // emit the SOURCE specifier verbatim (REQ-15)
    expect(resolveSpecifier('foo', { baseDir: root })).toBe('./foo.dtx');
    expect(resolveSpecifier('bar', { baseDir: root })).toBe('./bar/module.dtx');
    expect(resolveSpecifier('shared', { baseDir: root, includes: [inc] })).toContain('.dtx');
    // not found + single segment → bare npm specifier, verbatim
    expect(resolveSpecifier('missing', { baseDir: root })).toBe('missing');
    // npm/explicit passthrough
    expect(resolveSpecifier('uidetox/forms', { baseDir: root })).toBe('uidetox/forms');
  });

  it('leaves bare npm specifiers verbatim; resolves .ts via extensions (REQ-14)', () => {
    const root = mkdtempSync(join(tmpdir(), 'dtx-res-'));
    mkdirSync(join(root, 'nested'), { recursive: true });
    writeFileSync(join(root, 'tokens.ts'), '');
    // bare npm specifiers — never rewritten to relative
    expect(resolveSpecifier('uidetox')).toBe('uidetox');
    expect(resolveSpecifier('lodash-es')).toBe('lodash-es');
    expect(resolveSpecifier('uidetox/forms')).toBe('uidetox/forms');
    expect(resolveSpecifier('./sibling.js')).toBe('./sibling.js');
    // a local .ts, found via extensions → project-relative, source extension kept (REQ-15)
    const fromNested = resolveSpecifier('tokens', { baseDir: join(root, 'nested'), includes: [root], extensions: ['.dtx', '.ts'] });
    expect(fromNested).toBe('../tokens.ts');
  });

  it('preserves the source extension in the emitted specifier (REQ-15)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ux-'));
    writeFileSync(join(dir, 'Foo.dtx'), 'component Foo tag foo\nend component\n');
    mkdirSync(join(dir, 'lib'), { recursive: true });
    writeFileSync(join(dir, 'lib', 'foo.ts'), '');
    expect(resolveSpecifier('Foo', { baseDir: dir, includes: [dir], extensions: ['.dtx'] })).toBe('./Foo.dtx');
    expect(resolveSpecifier('lib.foo', { baseDir: dir, includes: [dir], extensions: ['.dtx', '.ts'] })).toBe('./lib/foo.ts');
  });
});
