import type { Discovered } from './collect.js';
import type { RouteAst } from './routeTransform.js';

function emitRoute(route: RouteAst, routerPriority: number, routerGuards: string[]): string {
  const guardsArray = [...routerGuards, ...route.guards].join(', ');
  const parts: string[] = [];
  parts.push(`path: ${JSON.stringify(route.path)}`);
  parts.push(`handler: ${route.handlerExpr}`);
  parts.push(`paramsSchema: ${route.paramsSource}`);
  parts.push(`priority: ${routerPriority}`);
  parts.push(`guards: [${guardsArray}]`);
  parts.push(`status: ${route.status === null ? 'null' : route.status}`);
  parts.push('meta: {}');
  return `  { ${parts.join(', ')} }`;
}

export function emitRoutesModule(discovered: Discovered[]): string {
  const imports = new Set<string>();
  const routes: string[] = [];
  for (const d of discovered) {
    for (const imp of d.imports) imports.add(imp);
    for (const router of d.routers) {
      if (router.disabled) continue;
      for (const route of router.routes) {
        routes.push(emitRoute(route, router.priority, router.guards));
      }
    }
  }
  const header = [...imports].join('\n');
  return `${header}\n\nexport const routes = [\n${routes.join(',\n')}\n];\n`;
}
