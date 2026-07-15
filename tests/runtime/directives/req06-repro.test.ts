import { describe, expect, it } from 'vitest';
import { compileDtxSource } from '../../../src/compiler/dtx/emit.js';
import * as RT from '../../../src/runtime/index.js';
import { defineComponent } from '../../../src/runtime/component.js';
import { state } from '../../../src/runtime/state.js';

const settle = () => new Promise((r) => setTimeout(r, 40));

function evalComponent(code: string, extras: Record<string, unknown>): void {
  let n = 0;
  const body = code
    .split('\n')
    .filter((l) => !/^\s*import\s/.test(l))
    .join('\n')
    .replace(/^export default /gm, () => `const __def${n++} = `)
    .replace(/^export /gm, '');
  const names = Object.keys(extras);
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function(...names, body)(...names.map((n2) => extras[n2]));
}

// Two components in ONE .dtx file — the shape of the «Лад» req-06 minimal repro.
// Before the fix this emitted two `export default`, so the whole module failed to
// load with "Identifier '.default' has already been declared" and neither element
// registered — read as "nested <if> never mounts". The nested reactivity itself is
// fine; the module just never loaded.
const TWO_COMPONENTS = `
import state from "uidetox"

component Req06Repro export tag req06-repro
script
const s = state({ authed: false, ready: false, deep: false })
end script
actions
function step() {
  if (!s.authed) { s.authed = true; return }
  if (!s.ready) { s.ready = true; return }
  s.deep = !s.deep
}
end actions
template
<div>
  <button @click=\${step}>step</button>
  <if when=\${!s.authed}>
    <p>login</p>
    <else>
      <if when=\${!s.ready}>
        <p>loading</p>
        <else>
          <div class="content">
            <if when=\${s.deep}><p id="deep-marker">DEEP</p></if>
          </div>
      </if>
  </if>
</div>
end template
end component

component Req06Works export tag req06-works
template
<div>ok</div>
end template
end component
`;

describe('REQ-06: multi-component .dtx file + nested <if> reactivity', () => {
  it('emits exactly one default export for a two-component file', () => {
    const { code } = compileDtxSource(TWO_COMPONENTS);
    expect((code.match(/^export default /gm) ?? []).length).toBe(1);
    expect((code.match(/defineComponent\(/g) ?? []).length).toBe(2);
  });

  it('never emits two default exports when a router and a component share a file', () => {
    const src = `
router
routes
/ A
end routes
end router

component A export tag a-x
template
<div>a</div>
end template
end component
`;
    const { code } = compileDtxSource(src);
    expect((code.match(/^export default /gm) ?? []).length).toBe(1);
    // both still present: the router owns the default, the component still registers.
    expect((code.match(/defineComponent\(/g) ?? []).length).toBe(1);
  });

  it('registers both components and the nested <if> mounts when its signal flips', async () => {
    evalComponent(compileDtxSource(TWO_COMPONENTS).code, { ...RT, defineComponent, state });

    // both custom elements are defined (module loaded fully)
    expect(customElements.get('req06-repro')).toBeTruthy();
    expect(customElements.get('req06-works')).toBeTruthy();

    const el = document.createElement('req06-repro');
    document.body.appendChild(el);
    await settle();
    const step = () => (el.querySelector('button') as HTMLButtonElement).click();

    step(); await settle(); // authed
    step(); await settle(); // ready → content branch built (deep=false)
    expect(el.querySelector('.content')).not.toBeNull();
    expect(el.querySelector('#deep-marker')).toBeNull();

    step(); await settle(); // deep=true → nested <if> mounts
    expect(el.querySelector('#deep-marker')).not.toBeNull();

    el.remove();
  });
});
