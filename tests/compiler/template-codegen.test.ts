import { describe, expect, it } from 'vitest';
import { codegen } from '../../src/compiler/template/codegen.js';
import { parseTemplate } from '../../src/compiler/template/parse.js';

describe('codegen()', () => {
  it('emits a call to __el for a static element with text', () => {
    const js = codegen(parseTemplate('<div class="card">hi</div>'));
    expect(js).toContain('__el("div"');
    expect(js).toContain('__text("hi")');
    expect(js).toContain('["class", "static", "card"]');
  });

  it('emits reactive bindings via __bind', () => {
    const js = codegen(parseTemplate('<span>${props.title}</span>'));
    expect(js).toContain('__bind');
    expect(js).toContain('() => (props.title)');
  });

  it('emits binding descriptors with author-cased tag preserved', () => {
    const js = codegen(parseTemplate('<UserCard/>'));
    expect(js).toContain('__el("UserCard"');
  });
});
