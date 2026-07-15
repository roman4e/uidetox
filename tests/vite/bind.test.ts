import { describe, expect, it } from 'vitest';
import { compileModule } from '../../src/vite/compile.js';

const DTX = `import form, f from "ui-detox/forms"

component LoginForm tag login-form

script
const fm = form({ schema: f.object({ email: f.string().min(3) }), initial: { email: "" } });
end script

template
<form>
  <input bind=\${fm.field("email")} placeholder="Email"/>
  <field-error .of=\${fm.field("email")}></field-error>
</form>
end template

end component
`;

describe('bind=${fm.field(...)} in .dtx (§11.5)', () => {
  const { code } = compileModule('/x/LoginForm.dtx', DTX);

  it('lowers bind to a __bindField call, not a plain attribute', () => {
    expect(code).toContain('__bindField(');
    expect(code).toContain('fm.field("email")');
    // must NOT be emitted as a static/expression attribute named "bind"
    expect(code).not.toMatch(/\["bind",\s*"(static|expression)"/);
  });

  it('imports __bindField from the runtime', () => {
    expect(code).toContain('import { __bindField } from "ui-detox";');
  });

  it('passes the field object (not its stringified value) to __bindField', () => {
    // __bindField(<el>, (fm.field("email")))
    expect(code).toMatch(/__bindField\([\s\S]*?fm\.field\("email"\)\)/);
  });
});
