import { describe, expect, it } from 'vitest';
import { parseTemplate } from '../../../src/compiler/template/parse.js';
import type { TplElement } from '../../../src/compiler/template/ast.js';

function el(nodes: ReturnType<typeof parseTemplate>): TplElement {
  return nodes.find((n) => n.type === 'element') as TplElement;
}

describe('expression attribute values', () => {
  it('keeps handler expressions with interior spaces intact', () => {
    const e = el(parseTemplate('<button @click=${() => remove(index)}>x</button>'));
    const click = e.attrs.find((a) => a.name === '@click')!;
    expect(click.kind).toBe('event');
    expect(click.value).toBe('() => remove(index)');
  });

  it('keeps boolean expressions containing || intact', () => {
    const e = el(parseTemplate('<button ?disabled=${!form.valid || form.submitting}>x</button>'));
    const dis = e.attrs.find((a) => a.name === '?disabled')!;
    expect(dis.kind).toBe('boolean');
    expect(dis.value).toBe('!form.valid || form.submitting');
    // no stray split-off attributes
    expect(e.attrs).toHaveLength(1);
  });

  it('handles unquoted expression as last attr of a void element', () => {
    const e = el(parseTemplate("<input type=\"number\" bind=${fm.field('d')}/>"));
    const bind = e.attrs.find((a) => a.name === 'bind')!;
    expect(bind.kind).toBe('expression');
    expect(bind.value).toBe("fm.field('d')");
  });

  it('handles nested template-literal braces in an expression', () => {
    const e = el(parseTemplate('<input bind=${fm.field(`nutrients.${i}.code`)}/>'));
    const bind = e.attrs.find((a) => a.name === 'bind')!;
    expect(bind.kind).toBe('expression');
    expect(bind.value).toBe('fm.field(`nutrients.${i}.code`)');
  });

  it('resolves #${expr} refs after protection', () => {
    const e = el(parseTemplate('<div #${dynKey}>x</div>'));
    expect(e.refExpr).toBe('dynKey');
  });
});
