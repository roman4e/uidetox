import { describe, expect, it } from 'vitest';
import { compileDtxSource } from '../../../src/compiler/dtx/emit.js';
import { parseTemplate } from '../../../src/compiler/template/parse.js';
import { transformDirectives } from '../../../src/compiler/template/transform.js';
import { codegen } from '../../../src/compiler/template/codegen.js';
import * as RT from '../../../src/runtime/index.js';
import { defineComponent } from '../../../src/runtime/component.js';
import { state } from '../../../src/runtime/state.js';

const settle = () => new Promise((r) => setTimeout(r, 40));

// Eval compiled component code: drop imports, inject runtime as function params.
function evalComponent(code: string, extras: Record<string, unknown>): void {
  const body = code
    .split('\n')
    .filter((l) => !/^\s*import\s/.test(l))
    .join('\n')
    .replace(/^export default /m, 'const __def = ')
    .replace(/^export /gm, '');
  const names = Object.keys(extras);
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function(...names, body)(...names.map((n) => extras[n]));
}

// A popover whose measured `#pop` ref lives INSIDE a `<if>` (deferred render), and
// whose `effects` section positions it via `readFrame` once the ref + anchor land.
// Mirrors the «Лад» WordPopover shape (REQ-06 / REQ-08).
const POPOVER_DTX = `
component Pop export tag pop-el

props
object anchor
object token
end props

script
const hasTok = !!props.token
const pos = state({ ready: false })
function place() {
  const el = refs.pop
  const a = props.anchor
  if (!el || !a) return
  pos.ready = true
}
const popStyle = () => 'visibility:' + (pos.ready ? 'visible' : 'hidden')
end script

effects
effect(() => { if (props.anchor && refs.pop) readFrame(() => place()) })
end effects

template
<if when=\${hasTok}>
  <div #pop style=\${popStyle()}>\${props.token.surface}</div>
</if>
end template

end component
`;

describe('deferred refs + effects/readFrame (REQ-06 / REQ-08)', () => {
  it('effect re-runs when a #ref inside a deferred <if> lands, then readFrame measures', async () => {
    const { code } = compileDtxSource(POPOVER_DTX);
    // Inject runtime; `readFrame` is destructured from ctx by the compiled boot, so
    // this exercises the ctx.readFrame surface (not a bare import).
    evalComponent(code, { ...RT, defineComponent, state });

    // Parent mounts the popover inside NESTED <if>/<else>, passing object props via
    // `.prop` bindings — exactly how App.dtx mounts lad-word-popover.
    const s = state({
      authed: false,
      ready: false,
      sel: null as { token: unknown; rect: unknown } | null,
    });
    const NESTED = `
      <if when=\${!s.authed}>
        <span>auth</span>
        <else>
          <if when=\${!s.ready}>
            <span>loading</span>
            <else>
              <div>
                <if when=\${s.sel}>
                  <pop-el .token=\${s.sel.token} .anchor=\${s.sel.rect}></pop-el>
                </if>
              </div>
          </if>
      </if>`;
    const tpl = codegen(transformDirectives(parseTemplate(NESTED)));
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const bootFn = new Function('__el', '__text', '__if', '__fragment', '__bind', '__ref', 'ctx', 's', `return ${tpl};`);
    defineComponent({
      tag: 'app-under-test',
      boot: (ctx) => bootFn(RT.__el, RT.__text, RT.__if, RT.__fragment, RT.__bind, RT.__ref, ctx, s),
    });

    const host = document.createElement('app-under-test');
    document.body.appendChild(host);
    await settle();

    // Drive the async data-load sequence like the real app.
    s.authed = true; await settle();
    s.ready = true; await settle();
    expect(host.querySelector('pop-el')).toBeNull(); // sel null → no popover

    // Click: select a token with a native-object anchor (DOMRect-like).
    const rect = { left: 100, top: 200, width: 40, bottom: 220 };
    Object.setPrototypeOf(rect, { get x() { return 100; } }); // exotic proto → not wrapped (REQ-07)
    s.sel = { token: { surface: 'WORD' }, rect };
    await settle();

    // REQ-06: the element mounts inside the deeply-nested <if>.
    const pop = host.querySelector('pop-el');
    expect(pop).not.toBeNull();
    // gated content rendered.
    expect(pop!.textContent).toContain('WORD');
    // REQ-08: place() ran (effect re-ran when refs.pop landed, readFrame fired) →
    // the #pop div is visible, not stuck at visibility:hidden.
    const inner = pop!.querySelector('div') as HTMLElement | null;
    expect(inner).not.toBeNull();
    expect(inner!.getAttribute('style')).toBe('visibility:visible');

    host.remove();
  });
});
