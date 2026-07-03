import { mergeChain } from '../mro/apply.js';
import { resolveLinearization } from '../mro/linearize.js';
import type { FilterDescriptor, FilterTransformer } from './types.js';

const registry = new Map<string, FilterDescriptor>();
const mergedCache = new WeakMap<FilterDescriptor, FilterTransformer[]>();

function getMergedTransformers(desc: FilterDescriptor): FilterTransformer[] {
  let cached = mergedCache.get(desc);
  if (!cached) {
    const mro = resolveLinearization(desc);
    cached = mergeChain<FilterTransformer>(
      mro as Array<{ transformers?: FilterTransformer[]; offTransform?: string[] | 'all' }>,
      (t) => t.name,
    );
    mergedCache.set(desc, cached);
  }
  return cached;
}

export function defineFilter(
  name: string,
  spec: Omit<FilterDescriptor, 'name'>,
): (value: unknown, params?: Record<string, unknown>) => unknown {
  const descriptor: FilterDescriptor = { name, ...spec };
  registry.set(name, descriptor);
  const callable = (value: unknown, params?: Record<string, unknown>) => {
    const chain = getMergedTransformers(descriptor);
    const ctx = { params: params ?? {}, $transformers: chain };
    let current: unknown = value;
    for (const t of chain) current = t.run.call(ctx, current);
    return current;
  };
  (callable as unknown as { $descriptor: FilterDescriptor }).$descriptor = descriptor;
  return callable;
}

export function getFilter(name: string): FilterDescriptor | undefined {
  return registry.get(name);
}
