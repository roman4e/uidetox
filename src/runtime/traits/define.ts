import type { TraitDescriptor } from './types.js';

const registry = new Map<string, TraitDescriptor>();

export function defineTrait(name: string, spec: Omit<TraitDescriptor, 'name'>): TraitDescriptor {
  const descriptor: TraitDescriptor = { name, ...spec };
  registry.set(name, descriptor);
  return descriptor;
}

/**
 * Registers an imperative behavior trait (drag & drop, etc.) with only an
 * `attach` lifecycle — no declarative handlers/props.
 */
export function defineBehaviorTrait(
  name: string,
  appliesTo: string[],
  attach: NonNullable<TraitDescriptor['attach']>,
): TraitDescriptor {
  return defineTrait(name, {
    appliesTo,
    paramsSchema: {},
    props: () => ({}),
    handlers: {},
    attach,
  });
}

export function getTrait(name: string): TraitDescriptor | undefined {
  return registry.get(name);
}

export function clearTraitRegistry(): void {
  registry.clear();
}
