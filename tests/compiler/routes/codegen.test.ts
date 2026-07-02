import { describe, expect, it } from 'vitest';
import type { Discovered } from '../../../src/compiler/routes/collect.js';
import { emitRoutesModule } from '../../../src/compiler/routes/codegen.js';

const fixture: Discovered[] = [
  {
    file: 'routes.md',
    imports: ["import Home from './pages/Home.md';"],
    routers: [{
      mount: '',
      mode: 'history',
      slashPolicy: 'strict',
      guards: [],
      priority: 50,
      disabled: false,
      routes: [
        {
          path: '/',
          handlerExpr: 'Home',
          guards: [],
          status: null,
          paramsSource: '{}',
          children: [],
          nestedComponentExpr: null,
        },
        {
          path: '/users/:id',
          handlerExpr: 'User',
          guards: ['requireAuth'],
          status: null,
          paramsSource: '{ id: { type: "number", optional: false } }',
          children: [],
          nestedComponentExpr: null,
        },
      ],
    }],
  },
];

describe('emitRoutesModule()', () => {
  it('emits import lines + routes array', () => {
    const js = emitRoutesModule(fixture);
    expect(js).toContain("import Home from './pages/Home.md';");
    expect(js).toContain('export const routes');
    expect(js).toContain('path: "/users/:id"');
    expect(js).toContain('guards: [requireAuth]');
    expect(js).toContain('paramsSchema: { id: { type: "number", optional: false } }');
  });

  it('skips disabled routers', () => {
    const disabled = structuredClone(fixture);
    disabled[0].routers[0].disabled = true;
    const js = emitRoutesModule(disabled);
    expect(js).not.toContain('path: "/');
  });
});
