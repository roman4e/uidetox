export interface FilterTransformer {
  name: string | null;
  run(this: unknown, v: unknown): unknown;
}

export interface FilterDescriptor {
  name: string;
  input: string;
  output: string;
  paramsSchema: Record<string, unknown>;
  transformers: FilterTransformer[];
}
