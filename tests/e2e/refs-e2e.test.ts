import { describe, expect, it } from 'vitest';
import { compile } from '../../src/compiler/compile.js';

const SFC = `---
name: RefForm
tag: ref-form
---

\`\`\`html template
<form>
  <input name="email" type="email"/>
  <button #submit-btn>Send</button>
</form>
\`\`\`

\`\`\`ts script
// refs available in handlers
\`\`\`
`;

describe('refs e2e', () => {
  it('compiles __ref wrappers for name + #marker', () => {
    const { js } = compile(SFC);
    expect(js).toContain('__ref(ctx, "email"');
    expect(js).toContain('__ref(ctx, "submitBtn"');
    expect(js).toContain('const { props, host, refs, ref, find, findAll } = ctx;');
    expect(js).toContain('__ref');
  });
});
