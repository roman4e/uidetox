import { describe, expect, it } from 'vitest';
import { generateTsShim, generateElementInterface, isRouterSource } from '../../src/vite/shim.js';
import { buildShimsFile } from '../../src/vite/shims.js';

const ROUTES = `import Board from "pages.Board"
import NotFound from "pages.NotFound"

router AppRoutes export
routes
"/" -> Board
"/x/:id" -> Board { id: string }
"**" -> NotFound status=404
end routes
end router
`;

describe('router-verb shim (REQ-25)', () => {
  it('types the default export as RouteEntry[] and imports RouteEntry', () => {
    expect(isRouterSource(ROUTES)).toBe(true);
    const shim = generateTsShim('/proj/routes.dtx', ROUTES);
    expect(shim).toContain('import type { RouteEntry } from "ui-detox";');
    expect(shim).toContain('_default: RouteEntry[]');
    expect(shim).not.toContain('(props?: Props) => HTMLElement');
  });
});

describe('catch-all / route-pattern tags (REQ-26)', () => {
  it('does not synthesise an element interface from a route pattern', () => {
    // route patterns are not element names → no interface, no garbage TS
    expect(generateElementInterface('/proj/routes.dtx', ROUTES)).toBeNull();
  });

  it('rejects non-custom-element tags via extractTag path', () => {
    // a component whose "tag" would be `**`/`/` yields nothing
    expect(generateElementInterface('/x/a.dtx', 'component X tag **\nend component\n')).toBeNull();
    expect(generateElementInterface('/x/b.dtx', 'component X tag app-board\nend component\n')).not.toBeNull();
  });

  it('dedupes element interfaces for a handler reused across routes', () => {
    const entries = [
      { spec: 'pages.Board', path: '/x/Board.dtx', source: 'component Board tag app-board\nend component\n' },
      { spec: 'pages.Board2', path: '/y/Board.dtx', source: 'component Board tag app-board\nend component\n' },
    ];
    const file = buildShimsFile(entries);
    const count = (file.match(/"app-board": AppBoardElement;/g) ?? []).length;
    expect(count).toBe(1); // single tag-map entry, no duplicate
  });
});
