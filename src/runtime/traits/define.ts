import type { TraitDescriptor } from './types.js';

const registry = new Map<string, TraitDescriptor>();

export function defineTrait(name: string, spec: Omit<TraitDescriptor, 'name'>): TraitDescriptor {
  const descriptor: TraitDescriptor = { name, ...spec };
  registry.set(name, descriptor);
  return descriptor;
}

export function getTrait(name: string): TraitDescriptor | undefined {
  return registry.get(name);
}

export function clearTraitRegistry(): void {
  registry.clear();
}
