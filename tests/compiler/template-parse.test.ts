import { describe, expect, it } from 'vitest';
import { parseTemplate } from '../../src/compiler/template/parse.js';

describe('parseTemplate()', () => {
  it('parses a static element with text', () => {
    const ast = parseTemplate('<div class="card">hello</div>');
    expect(ast).toEqual([
      {
        type: 'element',
        tag: 'div',
        attrs: [{ name: 'class', kind: 'static', value: 'card' }],
        children: [{ type: 'text', value: 'hello' }],
      },
    ]);
  });

  it('recognises text interpolations', () => {
    const ast = parseTemplate('<span>${props.title}</span>');
    expect(ast[0]).toMatchObject({
      type: 'element',
      tag: 'span',
      children: [{ type: 'interpolation', expression: 'props.title' }],
    });
  });

  it('classifies binding attribute kinds', () => {
    const ast = parseTemplate(
      '<button @click="${onClick}" .disabled="${loading}" ?hidden="${hide}" data="${x}"></button>',
    );
    const el = ast[0] as { attrs: Array<{ name: string; kind: string; value: string }> };
    expect(el.attrs).toEqual([
      { name: '@click',   kind: 'event',      value: 'onClick' },
      { name: '.disabled',kind: 'property',   value: 'loading' },
      { name: '?hidden',  kind: 'boolean',    value: 'hide' },
      { name: 'data',     kind: 'expression', value: 'x' },
    ]);
  });

  it('preserves author-cased tag names', () => {
    const ast = parseTemplate('<UserCard/>');
    expect((ast[0] as { tag: string }).tag).toBe('UserCard');
  });
});
