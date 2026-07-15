import { describe, expect, it } from 'vitest';
import { parseTemplate } from '../../src/compiler/template/parse.js';
import { transformDirectives } from '../../src/compiler/template/transform.js';
import type { TplElement, TplFor } from '../../src/compiler/template/ast.js';
import { defineComponent } from '../../src/runtime/component.js';
import { __el, __for, __bind } from '../../src/runtime/domHelpers.js';
import { state } from '../../src/runtime/state.js';
import { flushSync } from '../../src/runtime/scheduler.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('control-flow inside <svg> (REQ-05-01)', () => {
  it('keeps a <for> body inside <svg> in the AST (foreign content)', () => {
    const nodes = transformDirectives(parseTemplate(
      '<svg viewBox="0 0 120 34"><path d=${props.path}/><for each=${props.dots} item="d"><circle cx=${d[0]} cy=${d[1]} r="2.4"/></for></svg>',
    ));
    const svg = nodes.find((n) => n.type === 'element' && (n as TplElement).tag === 'svg') as TplElement;
    const forNode = svg.children.find((c) => c.type === 'for') as TplFor;
    expect(forNode).toBeDefined();
    expect((forNode.body[0] as TplElement).tag).toBe('circle'); // <circle> preserved
  });

  it('renders SVG-namespaced elements from a <for>', () => {
    const s = state({ dots: [[10, 5], [20, 8], [30, 6]] as number[][] });
    defineComponent({
      tag: 'svg-contour',
      boot: (ctx) => __el('svg', [['viewBox', 'static', '0 0 120 34']], [
        __for(
          () => s.dots,
          (_d, i) => i,
          (d, _i, c) => __el('circle', [
            ['cx', 'expression', () => d[0]],
            ['cy', 'expression', () => d[1]],
            ['r', 'static', '2.4'],
          ], [], c),
          ctx,
        ),
      ], ctx),
    });

    const el = document.createElement('svg-contour');
    document.body.appendChild(el);
    return tick().then(() => {
      flushSync();
      const svg = el.querySelector('svg')!;
      expect(svg.namespaceURI).toBe(SVG_NS);          // svg root is SVG-namespaced
      const circles = svg.querySelectorAll('circle');
      expect(circles.length).toBe(3);
      expect(circles[0].namespaceURI).toBe(SVG_NS);   // iterated circles too
      expect(circles[1].getAttribute('cx')).toBe('20');
      s.dots = [[40, 9]];
      flushSync();
      expect(el.querySelectorAll('circle').length).toBe(1); // reactive re-diff
      el.remove();
    });
  });
});
