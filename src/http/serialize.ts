/**
 * Serializes a query object into a URL query string (without leading `?`).
 * - primitives → `key=value`
 * - arrays → repeated key (`?tag=a&tag=b`)
 * - nested objects → dot-notation (`?filter.min=0`)
 * - `null` / `undefined` → omitted
 */
export function serializeQuery(params: Record<string, unknown>): string {
  const parts: string[] = [];
  const enc = encodeURIComponent;

  const emit = (key: string, value: unknown): void => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      for (const item of value) emit(key, item);
      return;
    }
    if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        emit(`${key}.${k}`, v);
      }
      return;
    }
    parts.push(`${enc(key)}=${enc(String(value))}`);
  };

  for (const [key, value] of Object.entries(params)) emit(key, value);
  return parts.join('&');
}
