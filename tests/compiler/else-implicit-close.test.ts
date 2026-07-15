import { describe, expect, it } from 'vitest';
import { parseTemplate } from '../../src/compiler/template/parse.js';
import { transformDirectives } from '../../src/compiler/template/transform.js';

const ast = (tpl: string) => transformDirectives(parseTemplate(tpl));
const has = (nodes: unknown, needle: string) => JSON.stringify(nodes).includes(needle);
function countIfs(nodes: any[]): number {
  let n = 0;
  const walk = (ns: any[]) => {
    for (const node of ns) {
      if (node.type === 'if') { n++; walk(node.then ?? []); if (node.else) walk(node.else); }
      else if (node.type === 'element') walk(node.children ?? []);
    }
  };
  walk(nodes);
  return n;
}

// `<else>` implicitly closes at the enclosing `</if>` (like <li>). Before the fix,
// a bare `<else>` left the `<if>` template open and swallowed following siblings.
describe('<else> implicit close (REQ-06)', () => {
  it('keeps a sibling <if> that follows an <if>/<else> nested in a <div>', () => {
    const tree = ast('<div><if when=${a}><p>x</p><else><p>y</p></if></div><if when=${b}><p id="target">Z</p></if>');
    expect(countIfs(tree)).toBe(2);
    expect(has(tree, 'target')).toBe(true);
  });

  it('handles the «Лад» shape: nested sel-<if> after an <if>/<else> in a wrapper div', () => {
    const tree = ast(
      '<div class="pad"><div class="maxw"><if when=${m}><a/><else><b/></if></div>' +
      '<if when=${s}><if when=${p}><detail/><else><popover/></if></if></div>',
    );
    // three <if>: mode, sel, phone — the sel/phone pair must survive
    expect(countIfs(tree)).toBe(3);
    expect(has(tree, 'popover')).toBe(true);
  });

  it('else-branch is a container (its children are the else body)', () => {
    const tree = ast('<if when=${a}><p>then</p><else><p>elsebody</p></if>') as any[];
    expect(tree[0].type).toBe('if');
    expect(has(tree[0].else, 'elsebody')).toBe(true);
    expect(has(tree[0].then, 'then')).toBe(true);
  });

  it('nested <if>s inside an <else> branch are preserved', () => {
    const tree = ast('<if when=${a}>x<else><if when=${b}>y</if><if when=${c}><p id="target">z</p></if></if>');
    expect(countIfs(tree)).toBe(3);
    expect(has(tree, 'target')).toBe(true);
  });
});
