import type { ParamSchema, ParamValue } from './types.js';

export function coerceParam(
  raw: string | undefined,
  schema: ParamSchema,
): { ok: true; value: ParamValue | undefined } | { ok: false } {
  if (raw === undefined) {
    if (!schema.optional) return { ok: false };
    return { ok: true, value: schema.default as ParamValue | undefined };
  }
  if (schema.filter) {
    const filter = schema.filter;
    const ok = filter instanceof RegExp ? filter.test(raw) : filter(raw);
    if (!ok) return { ok: false };
  }
  switch (schema.type) {
    case 'string':
      return { ok: true, value: raw };
    case 'number': {
      const n = Number(raw);
      if (!Number.isFinite(n)) return { ok: false };
      return { ok: true, value: n };
    }
    case 'int': {
      if (!/^-?\d+$/.test(raw)) return { ok: false };
      const n = parseInt(raw, 10);
      return { ok: true, value: n };
    }
    case 'boolean':
      if (raw === 'true') return { ok: true, value: true };
      if (raw === 'false') return { ok: true, value: false };
      return { ok: false };
  }
}

export function applyParams(
  rawParams: Record<string, string>,
  schemas: Record<string, ParamSchema>,
):
  | { ok: true; params: Record<string, ParamValue> }
  | { ok: false; failedOn: string } {
  const params: Record<string, ParamValue> = {};
  for (const name of Object.keys(schemas)) {
    const schema = schemas[name];
    const raw = Object.prototype.hasOwnProperty.call(rawParams, name) ? rawParams[name] : undefined;
    const result = coerceParam(raw, schema);
    if (!result.ok) return { ok: false, failedOn: name };
    if (result.value !== undefined) params[name] = result.value;
  }
  return { ok: true, params };
}
