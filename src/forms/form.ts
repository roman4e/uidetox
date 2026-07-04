import { state } from '../runtime/state.js';
import { effect } from '../runtime/effect.js';
import { type ErrorMap, Schema, ObjectSchema, ArraySchema } from './schema.js';
import { getPath, setPath, parsePath } from './path.js';

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
  watch(path: string, cb: (value: unknown) => void): () => void;
  /** Merges server-side field errors (e.g. from an ApiError) into the error map. */
  applyServerErrors(err: { fieldErrors?: Record<string, string[]> } | null | undefined): void;
  submit(ev?: Event): Promise<void>;
  reset(newInitial?: T): void;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Walks a schema tree by a dotted path to the leaf schema (or null). */
function schemaAt(root: Schema, path: string): Schema | null {
  let cur: Schema | null = root;
  for (const key of parsePath(path)) {
    if (!cur) return null;
    if (cur instanceof ObjectSchema) cur = cur.fields()[key] ?? null;
    else if (cur instanceof ArraySchema) cur = /^\d+$/.test(key) ? cur.itemSchema() : null;
    else return null;
  }
  return cur;
}

export function form<T extends object>(config: FormConfig<T>): FormInstance<T> {
  const values = state(clone(config.initial)) as T;
  const errors = state<ErrorMap>({});
  const touched = state<Record<string, boolean>>({});
  const pending = state<Record<string, boolean>>({});
  const meta = state({ dirty: false, valid: false, submitting: false });
  let initial = clone(config.initial);
  const rules: CrossRule[] = [];

  // Sync errors are the source of truth; async + server errors merge on top per-path.
  let syncErrors: ErrorMap = {};
  const asyncErrors: ErrorMap = {};
  const serverErrors: ErrorMap = {};
  const asyncTokens: Record<string, number> = {};
  const asyncTimers: Record<string, ReturnType<typeof setTimeout>> = {};

  function recomputeDirty(): void {
    meta.dirty = JSON.stringify(values) !== JSON.stringify(initial);
  }

  function mergeErrors(): void {
    const next: ErrorMap = {};
    for (const [p, msgs] of Object.entries(syncErrors)) next[p] = [...msgs];
    for (const [p, msgs] of Object.entries(asyncErrors)) {
      (next[p] ??= []).push(...msgs);
    }
    for (const [p, msgs] of Object.entries(serverErrors)) {
      (next[p] ??= []).push(...msgs);
    }
    for (const k of Object.keys(errors)) if (!(k in next)) delete errors[k];
    Object.assign(errors, next);
    const noPending = Object.values(pending).every((v) => !v);
    meta.valid = Object.keys(next).length === 0 && noPending;
  }

  function revalidate(): void {
    const next: ErrorMap = {};
    config.schema.validate(values, '', next);
    for (const rule of rules) {
      if (!rule.pred(values)) {
        for (const p of rule.paths) (next[p] ??= []).push(rule.msg);
      }
    }
    syncErrors = next;
    mergeErrors();
  }

  function clearAsync(path: string): void {
    clearTimeout(asyncTimers[path]);
    delete asyncErrors[path];
    if (pending[path]) pending[path] = false;
  }

  function runAsync(path: string): void {
    const schema = schemaAt(config.schema, path);
    if (!schema || schema.asyncChecks.length === 0) return;
    // Skip while a sync error already stands, or the value is empty.
    if (syncErrors[path]?.length) { clearAsync(path); mergeErrors(); return; }
    const value = getPath(values, path);
    if (value === undefined || value === null || value === '') {
      clearAsync(path); mergeErrors(); return;
    }
    clearTimeout(asyncTimers[path]);
    const debounce = Math.max(...schema.asyncChecks.map((c) => c.debounceMs));
    pending[path] = true;
    mergeErrors();
    const token = (asyncTokens[path] = (asyncTokens[path] ?? 0) + 1);
    asyncTimers[path] = setTimeout(() => {
      void (async () => {
        const msgs: string[] = [];
        for (const c of schema.asyncChecks) {
          const r = await c.fn(value);
          if (r !== true) msgs.push(r);
        }
        if (asyncTokens[path] !== token) return; // superseded by a newer run
        pending[path] = false;
        if (msgs.length) asyncErrors[path] = msgs;
        else delete asyncErrors[path];
        mergeErrors();
      })();
    }, debounce);
  }

  function afterChange(path: string): void {
    // Editing a field dismisses any stale server error on it.
    if (serverErrors[path]) delete serverErrors[path];
    recomputeDirty();
    revalidate();
    runAsync(path);
  }

  function field(path: string): FieldHandle {
    return {
      get value() { return getPath(values, path); },
      get error() { return errors[path]?.[0]; },
      get errors() { return errors[path] ?? []; },
      get dirty() { return JSON.stringify(getPath(values, path)) !== JSON.stringify(getPath(initial, path)); },
      get touched() { return !!touched[path]; },
      get pending() { return !!pending[path]; },
      setValue(v: unknown) {
        setPath(values as Record<string, unknown>, path, v);
        afterChange(path);
      },
      setTouched(t: boolean) { touched[path] = t; },
      reset() {
        setPath(values as Record<string, unknown>, path, clone(getPath(initial, path)));
        afterChange(path);
      },
      append(item: unknown) {
        const arr = getPath(values, path) as unknown[];
        arr.push(item);
        afterChange(path);
      },
      removeAt(index: number) {
        const arr = getPath(values, path) as unknown[];
        arr.splice(index, 1);
        afterChange(path);
      },
      moveTo(from: number, to: number) {
        const arr = getPath(values, path) as unknown[];
        const [el] = arr.splice(from, 1);
        arr.splice(to, 0, el);
        afterChange(path);
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
    watch(path, cb) {
      return effect(() => { cb(getPath(values, path)); });
    },
    applyServerErrors(err) {
      for (const k of Object.keys(serverErrors)) delete serverErrors[k];
      if (err?.fieldErrors) {
        for (const [p, msgs] of Object.entries(err.fieldErrors)) {
          serverErrors[p] = [...msgs];
        }
      }
      mergeErrors();
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
      for (const k of Object.keys(pending)) delete pending[k];
      for (const k of Object.keys(asyncErrors)) delete asyncErrors[k];
      for (const k of Object.keys(serverErrors)) delete serverErrors[k];
      recomputeDirty();
      revalidate();
    },
  };
}
