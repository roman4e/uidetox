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
}
