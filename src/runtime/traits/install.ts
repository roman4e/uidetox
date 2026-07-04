import { getTrait } from './define.js';
import { mergeHandlers } from '../mro/apply.js';
import { resolveLinearization } from '../mro/linearize.js';
import type { TraitDescriptor } from './types.js';

export interface UseSpec {
  traitName: string;
  params: Record<string, unknown>;
}

export function parseUseAttribute(value: string): string[] {
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

const PARAM_RE = /^:([a-z][a-z0-9-]*)(?::([a-z][a-z0-9-]*))?$/;
function kebabToCamel(name: string): string {
  return name.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

export function parseParamAttribute(name: string): { trait: string | null; param: string } | null {
  const m = PARAM_RE.exec(name);
  if (!m) return null;
  if (m[2] === undefined) return { trait: null, param: kebabToCamel(m[1]) };
  return { trait: m[1], param: kebabToCamel(m[2]) };
}

const mergedCache = new WeakMap<TraitDescriptor, Record<string, TraitDescriptor['handlers'][string]>>();

function getMergedHandlers(desc: TraitDescriptor): Record<string, TraitDescriptor['handlers'][string]> {
  let cached = mergedCache.get(desc);
  if (!cached) {
    const mro = resolveLinearization(desc);
    cached = mergeHandlers(mro) as Record<string, TraitDescriptor['handlers'][string]>;
    mergedCache.set(desc, cached);
  }
  return cached;
}

function getMergedProps(desc: TraitDescriptor): Record<string, unknown> {
  const mro = resolveLinearization(desc);
  const merged: Record<string, unknown> = {};
  for (let i = mro.length - 1; i >= 0; i--) Object.assign(merged, mro[i].props());
  return merged;
}

export function installTraits(_root: Element, useMap: Map<Element, UseSpec[]>): () => void {
  const disposals: Array<() => void> = [];
  for (const [el, specs] of useMap) {
    for (const spec of specs) {
      const trait = getTrait(spec.traitName);
      if (!trait) continue;
      const props = getMergedProps(trait);
      const context = { el, event: null as Event | null, params: spec.params, ...props };
      if (trait.attach) {
        const cleanup = trait.attach(el, spec.params);
        if (typeof cleanup === 'function') disposals.push(cleanup);
      }
      const merged = getMergedHandlers(trait);
      for (const [event, handlers] of Object.entries(merged)) {
        for (const handler of handlers) {
          const listener = (e: Event) => {
            context.event = e;
            handler.run.call(context);
            context.event = null;
          };
          el.addEventListener(event, listener);
          disposals.push(() => el.removeEventListener(event, listener));
        }
      }
    }
  }
  return () => { for (const d of disposals) d(); };
}
