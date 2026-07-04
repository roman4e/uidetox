export type ErrorMap = Record<string, string[]>;

export interface AsyncCheck {
  fn: (value: unknown) => Promise<string | true>;
  debounceMs: number;
}

type Check = (value: unknown) => string | null;

function push(errors: ErrorMap, path: string, msg: string): void {
  (errors[path] ??= []).push(msg);
}

export abstract class Schema {
  protected checks: Check[] = [];
  protected isOptional = false;
  readonly asyncChecks: AsyncCheck[] = [];

  optional(): this {
    this.isOptional = true;
    return this;
  }

  refine(pred: (v: never) => boolean, message: string): this {
    this.checks.push((v) => (pred(v as never) ? null : message));
    return this;
  }

  asyncCheck(fn: (v: never) => Promise<string | true>, opts: { debounceMs?: number } = {}): this {
    this.asyncChecks.push({ fn: fn as (v: unknown) => Promise<string | true>, debounceMs: opts.debounceMs ?? 300 });
    return this;
  }

  validate(value: unknown, path: string, errors: ErrorMap): void {
    if (value === undefined || value === null || value === '') {
      if (!this.isOptional) push(errors, path, 'required');
      return;
    }
    const typeErr = this.checkType(value);
    if (typeErr) { push(errors, path, typeErr); return; }
    for (const c of this.checks) {
      const msg = c(value);
      if (msg) push(errors, path, msg);
    }
    this.validateChildren(value, path, errors);
  }

  protected abstract checkType(value: unknown): string | null;
  protected validateChildren(_value: unknown, _path: string, _errors: ErrorMap): void {}
}

class StringSchema extends Schema {
  protected checkType(v: unknown): string | null {
    return typeof v === 'string' ? null : 'must be a string';
  }
  min(n: number): this { this.checks.push((v) => ((v as string).length >= n ? null : `min length ${n}`)); return this; }
  max(n: number): this { this.checks.push((v) => ((v as string).length <= n ? null : `max length ${n}`)); return this; }
}

class NumberSchema extends Schema {
  protected checkType(v: unknown): string | null {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? null : 'must be a number';
  }
  private num(v: unknown): number { return typeof v === 'number' ? v : Number(v); }
  min(n: number): this { this.checks.push((v) => (this.num(v) >= n ? null : `min ${n}`)); return this; }
  max(n: number): this { this.checks.push((v) => (this.num(v) <= n ? null : `max ${n}`)); return this; }
  positive(): this { this.checks.push((v) => (this.num(v) > 0 ? null : 'must be positive')); return this; }
  int(): this { this.checks.push((v) => (Number.isInteger(this.num(v)) ? null : 'must be an integer')); return this; }
}

class BooleanSchema extends Schema {
  protected checkType(v: unknown): string | null {
    return typeof v === 'boolean' ? null : 'must be a boolean';
  }
}

class EnumSchema extends Schema {
  constructor(private options: readonly string[]) { super(); }
  protected checkType(v: unknown): string | null {
    return this.options.includes(v as string) ? null : `must be one of ${this.options.join(', ')}`;
  }
}

class ObjectSchema extends Schema {
  constructor(private shape: Record<string, Schema>) { super(); }
  protected checkType(v: unknown): string | null {
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? null : 'must be an object';
  }
  protected validateChildren(value: unknown, path: string, errors: ErrorMap): void {
    const obj = value as Record<string, unknown>;
    for (const [key, schema] of Object.entries(this.shape)) {
      const childPath = path ? `${path}.${key}` : key;
      schema.validate(obj[key], childPath, errors);
    }
  }
  fields(): Record<string, Schema> { return this.shape; }
}

class ArraySchema extends Schema {
  private minLen = 0;
  constructor(private item: Schema) { super(); }
  protected checkType(v: unknown): string | null {
    return Array.isArray(v) ? null : 'must be an array';
  }
  min(n: number): this { this.minLen = n; return this; }
  protected validateChildren(value: unknown, path: string, errors: ErrorMap): void {
    const arr = value as unknown[];
    if (arr.length < this.minLen) push(errors, path, `min ${this.minLen} item(s)`);
    arr.forEach((el, i) => {
      const childPath = path ? `${path}.${i}` : String(i);
      this.item.validate(el, childPath, errors);
    });
  }
  itemSchema(): Schema { return this.item; }
}

export const f = {
  string: () => new StringSchema(),
  number: () => new NumberSchema(),
  boolean: () => new BooleanSchema(),
  enum: (options: readonly string[]) => new EnumSchema(options),
  object: (shape: Record<string, Schema>) => new ObjectSchema(shape),
  array: (item: Schema) => new ArraySchema(item),
};

export { ObjectSchema, ArraySchema };
