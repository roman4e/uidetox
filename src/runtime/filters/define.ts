import type { FilterDescriptor } from './types.js';

const registry = new Map<string, FilterDescriptor>();

export function defineFilter(
  name: string,
  spec: Omit<FilterDescriptor, 'name'>,
): (value: unknown, params?: Record<string, unknown>) => unknown {
  const descriptor: FilterDescriptor = { name, ...spec };
  registry.set(name, descriptor);
  const callable = (value: unknown, params?: Record<string, unknown>) => {
    const ctx = { params: params ?? {}, $transformers: spec.transformers };
    let current: unknown = value;
    for (const t of spec.transformers) {
      current = t.run.call(ctx, current);
    }
    return current;
  };
  (callable as unknown as { $descriptor: FilterDescriptor }).$descriptor = descriptor;
  return callable;
}

export function getFilter(name: string): FilterDescriptor | undefined {
  return registry.get(name);
}
