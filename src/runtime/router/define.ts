import { runGuards } from './guards.js';
import { matchPath, specificity } from './match.js';
import { createController, type NavigateController } from './navigate.js';
import { setActiveController, installNavLinks, setActiveRouteState } from './navigate-api.js';
import { state } from '../state.js';
import { applyParams } from './params.js';
import { applySlashPolicy, type SlashPolicy } from './slashPolicy.js';
import type {
  Location,
  ParamValue,
  Redirect,
  RouteEntry,
} from './types.js';

export interface RouterConfig {
  routes: RouteEntry[];
  mode?: 'history' | 'hash';
  slashPolicy?: SlashPolicy;
}

export interface MatchedRoute {
  entry: RouteEntry;
  params: Record<string, ParamValue>;
  location: Location;
}

export interface RouteState {
  path: string;
  params: Record<string, ParamValue>;
  meta: Record<string, unknown>;
}

export interface RouterInstance {
  start(): void;
  stop(): void;
  controller: NavigateController;
  /** Reactive current-match state; read `.path`/`.params`/`.meta` in an effect. */
  state: RouteState;
  onMatched(fn: (m: MatchedRoute) => void): () => void;
}

function sorted(entries: RouteEntry[]): RouteEntry[] {
  return [...entries].sort((a, b) => {
    const sa = specificity(a.path);
    const sb = specificity(b.path);
    if (sa[0] !== sb[0]) return sb[0] - sa[0];
    if (sa[1] !== sb[1]) return sb[1] - sa[1];
    if (sa[2] !== sb[2]) return sa[2] - sb[2];
    return b.priority - a.priority;
  });
}

export function defineRouter(config: RouterConfig): RouterInstance {
  const routes = sorted(config.routes);
  const mode = config.mode ?? 'history';
  const slashPolicy = config.slashPolicy ?? 'strict';
  const controller = createController(mode);
  const listeners = new Set<(m: MatchedRoute) => void>();
  const routeStateStore = state<{ path: string; params: Record<string, ParamValue>; meta: Record<string, unknown> }>({
    path: '',
    params: {},
    meta: {},
  });

  const tryOne = (
    u: string,
  ): { entry: RouteEntry; params: Record<string, ParamValue> } | null => {
    for (const entry of routes) {
      const m = matchPath(entry.path, u);
      if (!m) continue;
      const coerced = applyParams(m.rawParams, entry.paramsSchema);
      if (!coerced.ok) continue;
      return { entry, params: coerced.params };
    }
    return null;
  };

  async function tryMatch(location: Location): Promise<void> {
    const url = location.path || '/';
    const first = tryOne(url);

    let matchedEntry: RouteEntry | null = null;
    let matchedParams: Record<string, ParamValue> = {};

    if (first) {
      matchedEntry = first.entry;
      matchedParams = first.params;
    } else {
      const fallback = applySlashPolicy(slashPolicy, url, (alt) => tryOne(alt) !== null);
      if (fallback) {
        controller.goto(fallback.url, { replace: true });
        return;
      }
    }

    if (!matchedEntry) return;

    const guardResult = await runGuards(matchedEntry.guards, {
      params: matchedParams,
      route: matchedEntry,
      location,
    });
    if (guardResult === false) return;
    if (guardResult !== true) {
      const r = guardResult as Redirect;
      controller.goto(r.url, { replace: r.replace });
      return;
    }

    // Reactive route state (§11.11): components subscribe via effect.
    routeStateStore.path = matchedEntry.path;
    routeStateStore.params = matchedParams;
    routeStateStore.meta = matchedEntry.meta;

    const notified: MatchedRoute = { entry: matchedEntry, params: matchedParams, location };
    for (const fn of [...listeners]) fn(notified);
  }

  let unsub: (() => void) | null = null;

  return {
    controller,
    state: routeStateStore,
    onMatched(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    start() {
      setActiveController(controller);
      setActiveRouteState(routeStateStore);
      installNavLinks();
      unsub = controller.onChange(tryMatch);
      void tryMatch(controller.current());
    },
    stop() {
      unsub?.();
      unsub = null;
      setActiveController(null);
      setActiveRouteState(null);
    },
  };
}
