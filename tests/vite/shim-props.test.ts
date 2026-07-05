import { describe, expect, it } from 'vitest';
import { generateTsShim } from '../../src/vite/shim.js';

const DTX = `import type { Node } from "./graph-types.js"

component RecipeCard tag recipe-card
props
number start default 0
boolean? open false
string? placeholder "Type here"
"first"|"second"|"dessert"|"special" category
Node[] nodes
end props
template
<div/>
end template
end component
`;

describe('props block shim (§11.3)', () => {
  const shim = generateTsShim('/x/RecipeCard.dtx', DTX);

  it('maps primitive types and honors ? optionality', () => {
    expect(shim).toContain('start?: number;');
    expect(shim).toContain('open?: boolean;');
    expect(shim).toContain('placeholder?: string;');
  });

  it('passes through a union type verbatim', () => {
    expect(shim).toContain('category?: "first"|"second"|"dessert"|"special";');
  });

  it('passes through a named-type reference and carries its import', () => {
    expect(shim).toContain('nodes?: Node[];');
    expect(shim).toContain('import type { Node } from "./graph-types.js"');
  });
});
