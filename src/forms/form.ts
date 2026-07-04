import { state } from '../runtime/state.js';
import type { ErrorMap, Schema } from './schema.js';
import { getPath, setPath } from './path.js';

export interface FieldHandle {
  readonly value: unknown;
  readonly error: string | undefined;
  readonly errors: string[];
  readonly dirty: boolean;
  readonly touched: boolean;
  readonly pending: boolean;
  setValue(v: unknown): void;
  setTouched(t: boolean): void;
  reset(): void;
  append(item: unknown): void;
  removeAt(index: number): void;
  moveTo(from: number, to: number): void;
}

export interface CrossRule {
  pred: (values: unknown) => boolean;
  msg: string;
  paths: string[];
}

export interface FormConfig<T> {
  schema: Schema;
  initial: T;
  onSubmit?: (value: T) => void | Promise<void>;
}

export interface FormInstance<T> {
  values: T;
  errors: ErrorMap;
  touched: Record<string, boolean>;
  dirty: boolean;
  valid: boolean;
  submitting: boolean;
  field(path: string): FieldHandle;
  rule(pred: (values: T) => boolean, msg: string, paths: string[]): void;
  submit(ev?: Event): Promise<void>;
  reset(newInitial?: T): void;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function form<T extends object>(config: FormConfig<T>): FormInstance<T> {
  const values = state(clone(config.initial)) as T;
  const errors = state<ErrorMap>({});
  const touched = state<Record<string, boolean>>({});
  const meta = state({ dirty: false, valid: false, submitting: false });
  let initial = clone(config.initial);
  const rules: CrossRule[] = [];

  function recomputeDirty(): void {
    meta.dirty = JSON.stringify(values) !== JSON.stringify(initial);
  }

  function revalidate(): void {
    const next: ErrorMap = {};
    config.schema.validate(values, '', next);
    for (const rule of rules) {
      if (!rule.pred(values)) {
        for (const p of rule.paths) (next[p] ??= []).push(rule.msg);
      }
    }
    for (const k of Object.keys(errors)) delete errors[k];
    Object.assign(errors, next);
    meta.valid = Object.keys(next).length === 0;
  }

  function field(path: string): FieldHandle {
    return {
      get value() { return getPath(values, path); },
      get error() { return errors[path]?.[0]; },
      get errors() { return errors[path] ?? []; },
      get dirty() { return JSON.stringify(getPath(values, path)) !== JSON.stringify(getPath(initial, path)); },
      get touched() { return !!touched[path]; },
      get pending() { return false; },
      setValue(v: unknown) {
        setPath(values as Record<string, unknown>, path, v);
        recomputeDirty();
        revalidate();
      },
      setTouched(t: boolean) { touched[path] = t; },
      reset() {
        setPath(values as Record<string, unknown>, path, clone(getPath(initial, path)));
        recomputeDirty();
        revalidate();
      },
      append(item: unknown) {
        const arr = getPath(values, path) as unknown[];
        arr.push(item);
        recomputeDirty();
        revalidate();
      },
      removeAt(index: number) {
        const arr = getPath(values, path) as unknown[];
        arr.splice(index, 1);
        recomputeDirty();
        revalidate();
      },
      moveTo(from: number, to: number) {
        const arr = getPath(values, path) as unknown[];
        const [el] = arr.splice(from, 1);
        arr.splice(to, 0, el);
        recomputeDirty();
        revalidate();
      },
    };
  }

  revalidate();

  return {
    values,
    errors,
    touched,
    get dirty() { return meta.dirty; },
    get valid() { return meta.valid; },
    get submitting() { return meta.submitting; },
    field,
    rule(pred, msg, paths) {
      rules.push({ pred: pred as (v: unknown) => boolean, msg, paths });
      revalidate();
    },
    async submit(ev?: Event) {
      ev?.preventDefault?.();
      meta.submitting = true;
      try {
        revalidate();
        if (meta.valid && config.onSubmit) {
          await config.onSubmit(clone(values));
        }
      } finally {
        meta.submitting = false;
      }
    },
    reset(newInitial?: T) {
      if (newInitial) initial = clone(newInitial);
      const fresh = clone(initial);
      for (const k of Object.keys(values as Record<string, unknown>)) {
        (values as Record<string, unknown>)[k] = (fresh as Record<string, unknown>)[k];
      }
      for (const k of Object.keys(touched)) delete touched[k];
      recomputeDirty();
      revalidate();
    },
  };
}
