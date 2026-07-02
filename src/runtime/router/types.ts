export type ParamType = 'string' | 'number' | 'int' | 'boolean';

export interface ParamSchema {
  type: ParamType;
  filter?: RegExp | ((v: string) => boolean);
  default?: unknown;
  optional: boolean;
}

export type ParamValue = string | number | boolean;

export interface LazyHandler {
  readonly __lazy: true;
  readonly load: () => Promise<Handler>;
}

export type Handler =
  | ((ctx: RouteContext) => Node | Promise<Node>)
  | LazyHandler;

export interface Location {
  path: string;
  search: string;
  hash: string;
  fullUrl: string;
}

export interface NavigationContext {
  params: Record<string, ParamValue>;
  route: RouteEntry;
  location: Location;
}

export type RouteContext = NavigationContext;

export class Redirect {
  constructor(
    public readonly url: string,
    public readonly replace: boolean = true,
  ) {}
}

export type Guard = (
  ctx: NavigationContext,
) => boolean | Redirect | Promise<boolean | Redirect>;

export interface RouteEntry {
  path: string;
  handler: Handler;
  paramsSchema: Record<string, ParamSchema>;
  priority: number;
  guards: Guard[];
  status: number | null;
  meta: Record<string, unknown>;
}

export function lazy(load: () => Promise<{ default: Handler } | Handler>): LazyHandler {
  return {
    __lazy: true,
    load: async () => {
      const mod = await load();
      return (mod as { default?: Handler }).default ?? (mod as Handler);
    },
  };
}
