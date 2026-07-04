import { describe, expect, it } from 'vitest';
import { scanSource } from '../../../src/compiler/dtx/lines.js';

describe('scanSource()', () => {
  it('scans a component with section + signature members', () => {
    const src = `import big-number
component Counter export tag app-counter

props
number start
end props

script
const s = state({ count: 0 });
end script

tpl
<div>\${s.count}</div>
end tpl

end component
`;
    const out = scanSource(src);
    expect(out.imports).toEqual(['import big-number']);
    expect(out.blocks).toHaveLength(1);
    const b = out.blocks[0];
    expect(b.verb).toBe('component');
    expect(b.header).toContain('Counter export tag app-counter');
    const props = b.members.find((m) => m.keyword === 'props');
    expect(props?.kind).toBe('section');
    expect(props?.body.trim()).toBe('number start');
    const script = b.members.find((m) => m.keyword === 'script');
    expect(script?.body).toContain('const s = state');
    const tpl = b.members.find((m) => m.keyword === 'tpl');
    expect(tpl?.body.trim()).toBe('<div>${s.count}</div>');
  });

  it('auto-closes a section at the next keyword without explicit end', () => {
    const src = `component X tag x-x
script
const a = 1;
tpl
<div/>
`;
    const out = scanSource(src);
    const b = out.blocks[0];
    const script = b.members.find((m) => m.keyword === 'script');
    expect(script?.body.trim()).toBe('const a = 1;');
    const tpl = b.members.find((m) => m.keyword === 'tpl');
    expect(tpl?.body.trim()).toBe('<div/>');
  });

  it('captures signature members with brace bodies', () => {
    const src = `trait trim appliesto [input]
on blur trim_handler() { this.el.value = this.el.value.trim(); }
`;
    const out = scanSource(src);
    const b = out.blocks[0];
    expect(b.verb).toBe('trait');
    const on = b.members.find((m) => m.keyword === 'on');
    expect(on?.kind).toBe('signature');
    expect(on?.header).toContain('on blur trim_handler()');
    expect(on?.body).toContain('this.el.value.trim()');
  });

  it('marks style scoped modifier', () => {
    const src = `component X tag x-x
style scoped
.x { color: red; }
end style
`;
    const out = scanSource(src);
    const style = out.blocks[0].members.find((m) => m.keyword === 'style');
    expect(style?.scoped).toBe(true);
    expect(style?.body.trim()).toBe('.x { color: red; }');
  });
});
