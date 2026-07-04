export interface TraitHandlerSpec {
  name: string | null;
  run(this: unknown): void;
}

export interface TraitDescriptor {
  name: string;
  appliesTo: string[];
  paramsSchema: Record<string, unknown>;
  props: () => Record<string, unknown>;
  handlers: Record<string, TraitHandlerSpec[]>;
  extends?: TraitDescriptor[];
  off?: Record<string, string[] | 'all'>;
  /**
   * Imperative lifecycle for behavior traits (e.g. drag & drop). Runs once when
   * the trait is installed on an element; the returned function is called on
   * teardown. Complements the declarative `handlers` map.
   */
  attach?: (el: Element, params: Record<string, unknown>) => (() => void) | void;
}
