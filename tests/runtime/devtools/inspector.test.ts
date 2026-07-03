import { describe, expect, it } from 'vitest';
import { inspectComponentTree } from '../../../src/runtime/devtools/inspector.js';

function mount(html: string): Element {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

describe('inspectComponentTree()', () => {
  it('lists custom elements only', () => {
    const root = mount('<app-root><div><app-card id="a"></app-card><span>text</span></div></app-root>');
    const tree = inspectComponentTree(root);
    expect(tree).toHaveLength(1);
    expect(tree[0].tag).toBe('app-root');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].tag).toBe('app-card');
    expect(tree[0].children[0].attrs.id).toBe('a');
  });
});
