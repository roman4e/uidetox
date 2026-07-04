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

  it('side-effect import (no from) resolves the name', () => {
    const { code } = compileDtx('import my-widget\n');
    expect(code).toContain('import "./my-widget.js";');
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

    expect(resolveSpecifier('foo', { baseDir: root })).toBe('./foo.js');
    expect(resolveSpecifier('bar', { baseDir: root })).toBe('./bar/module.js');
    expect(resolveSpecifier('shared', { baseDir: root, includes: [inc] })).toContain('.js');
    // not found anywhere → direct fallback
    expect(resolveSpecifier('missing', { baseDir: root })).toBe('./missing.js');
    // npm/explicit passthrough
    expect(resolveSpecifier('uidetox/forms', { baseDir: root })).toBe('uidetox/forms');
  });
});
