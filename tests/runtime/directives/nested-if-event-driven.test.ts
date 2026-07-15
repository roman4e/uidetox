import { describe, expect, it } from 'vitest';
import { compileDtxSource } from '../../../src/compiler/dtx/emit.js';
import * as RT from '../../../src/runtime/index.js';
import { defineComponent } from '../../../src/runtime/component.js';
import { state } from '../../../src/runtime/state.js';

const settle = () => new Promise((r) => setTimeout(r, 40));

function evalModule(code: string): void {
  let n = 0;
  const body = code.split('\n').filter((l) => !/^\s*import\s/.test(l)).join('\n')
    .replace(/^export default /gm, () => `const __def${n++} = `).replace(/^export /gm, '');
  const extras = { ...RT, defineComponent, state } as Record<string, unknown>;
  const names = Object.keys(extras);
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function(...names, body)(...names.map((k) => extras[k]));
}

// The real «Лад» shape: a deeply-nested <if when=${s.sel}> whose branch is built
// deferred (via outer <else>), and s.sel is set from a CHILD's @select event
// relayed through a middle component (stopPropagation + re-emit), not a same-scope
// button. This is the exact pattern the port reported as "never mounts".
const SRC = `
import state from "ui-detox"

component TokenX export tag token-x
template
<button @click=\${() => emit("select", { rect: { left: 1 } })}>tok</button>
end template
end component

component SingleX export tag single-x
actions
function pick(e) { e.stopPropagation(); emit("select", { token: { surface: "W" }, rect: e.detail.rect }) }
end actions
template
<div><token-x @select=\${pick}></token-x></div>
end template
end component

component AppX export tag app-x
script
const s = state({ authed: false, ready: false, sel: null })
const view = { get phone() { return false } }
end script
actions
function step() { if (!s.authed) { s.authed = true; return } s.ready = true }
function onSelect(e) { s.sel = { token: e.detail.token, rect: e.detail.rect } }
end actions
template
<div>
  <button #step @click=\${step}>step</button>
  <if when=\${!s.authed}>
    <p>login</p>
    <else>
      <if when=\${!s.ready}>
        <p>loading</p>
        <else>
          <div class="content">
            <single-x @select=\${onSelect}></single-x>
          </div>
          <if when=\${s.sel && !view.phone}>
            <p id="deep-marker">POP \${s.sel.token.surface}</p>
          </if>
      </if>
  </if>
</div>
end template
end component
`;

describe('nested <if> reacts to signal set via a relayed child @select event', () => {
  it('mounts the deferred inner <if> when s.sel arrives from the child relay', async () => {
    evalModule(compileDtxSource(SRC).code);

    const app = document.createElement('app-x');
    document.body.appendChild(app);
    await settle();

    const stepBtn = app.querySelector('button') as HTMLButtonElement; // first button = step
    stepBtn.click(); await settle();   // authed
    stepBtn.click(); await settle();   // ready → content built (deferred branch)
    expect(app.querySelector('.content')).not.toBeNull();
    expect(app.querySelector('token-x button')).not.toBeNull();
    expect(app.querySelector('#deep-marker')).toBeNull();

    // child emits → relayed → s.sel set → deferred inner <if> must mount
    (app.querySelector('token-x button') as HTMLButtonElement).click();
    await settle();
    expect(app.querySelector('#deep-marker')).not.toBeNull();
    expect(app.querySelector('#deep-marker')!.textContent).toContain('W');

    app.remove();
  });
});
