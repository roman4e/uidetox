import { describe, expect, it } from 'vitest';
import { compile } from '../../src/compiler/compile.js';

const SFC = `---
name: NameField
tag: name-field
---

\`\`\`html template
<form>
  <input bind=\${form.field('name')} type="text"/>
  <field-error .of=\${form.field('name')}></field-error>
</form>
\`\`\`

\`\`\`ts script
// form comes from props
\`\`\`
`;

describe('bind attribute e2e', () => {
  it('wraps bound elements in __bindField and imports it', () => {
    const { js } = compile(SFC);
    expect(js).toContain("__bindField(");
    expect(js).toContain("form.field('name')");
    expect(js).toContain('__bindField');
  });
});
