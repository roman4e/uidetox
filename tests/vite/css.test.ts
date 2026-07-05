import { describe, expect, it } from 'vitest';
import { extractStyleSource, scopeCss, stripInlineStyle } from '../../src/vite/css.js';
import { uidetox, createUidetoxCore } from '../../src/vite/plugin.js';

const DTX = `component Login tag app-login
template
<form><button class="btn">Go</button></form>
end template
style scoped
.btn { color: var(--fg); }
.btn:hover { color: red; }
end style
end component
`;

describe('extractStyleSource', () => {
  it('reads a scoped .dtx style body', () => {
    const s = extractStyleSource('/x/Login.dtx', DTX);
    expect(s?.scoped).toBe(true);
    expect(s?.css).toContain('.btn { color: var(--fg); }');
  });

  it('reads a .md style fence', () => {
    const md = '---\ntag: x-y\n---\n\n```css style\n.a { color: blue; }\n```\n';
    expect(extractStyleSource('/x/y.md', md)?.css).toContain('.a { color: blue; }');
  });
});

describe('scopeCss', () => {
  it('prefixes selectors with the tag but leaves :root and at-rules', () => {
    const out = scopeCss('.btn { color: red; }\n:root { --fg: black; }\n@media (min-width: 1px) { .btn { color: blue; } }', 'app-login');
    expect(out).toContain('app-login .btn { color: red; }');
    expect(out).toContain(':root { --fg: black; }');    // untouched → var() inheritance preserved
    expect(out).toContain('@media');
  });

  it('scopes comma-separated selectors individually', () => {
    expect(scopeCss('.a, .b { color: red; }', 't-x')).toContain('t-x .a, t-x .b');
  });
});

describe('stripInlineStyle', () => {
  it('removes the inline style field from compiled JS', () => {
    const code = 'defineComponent({\n  tag: "x",\n  boot: (ctx) => {},\n  style: ".a { color: red; }"\n});';
    expect(stripInlineStyle(code)).not.toContain('style:');
    expect(stripInlineStyle(code)).toContain('tag: "x"');
  });
});

describe('plugin CSS extraction', () => {
  it('replaces inline style with a virtual CSS import and serves it', () => {
    const core = createUidetoxCore();
    const out = core.transform(DTX, '/x/Login.dtx');
    expect(out?.code).toMatch(/import "virtual:uidetox-css\/[a-f0-9]+\.css";/);
    expect(out?.code).not.toContain('style:');
    const m = /import "(virtual:uidetox-css\/[a-f0-9]+\.css)";/.exec(out!.code)!;
    const css = core.getCss(m[1]);
    expect(css).toContain('app-login .btn');
  });

  it('resolveId + load serve the virtual CSS (with \\0 prefix)', () => {
    const p = uidetox();
    (p.transform as (c: string, id: string) => unknown)(DTX, '/x/Login.dtx');
    const resolved = (p.resolveId as (id: string) => string | null)('virtual:uidetox-css/abc.css');
    expect(resolved).toBe('\0virtual:uidetox-css/abc.css');
  });

  it('can be disabled with extractCss:false (keeps inline style)', () => {
    const core = createUidetoxCore({ extractCss: false });
    const out = core.transform(DTX, '/x/Login2.dtx');
    expect(out?.code).toContain('style:');
    expect(out?.code).not.toContain('virtual:uidetox-css');
  });
});
