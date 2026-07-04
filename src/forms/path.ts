export function parsePath(path: string): string[] {
  return path
    .replace(/\[(\w+)\]/g, '.$1')
    .split('.')
    .filter((s) => s.length > 0);
}

export function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const key of parsePath(path)) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

export function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = parsePath(path);
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const nextIsIndex = /^\d+$/.test(keys[i + 1]);
    if (cur[key] === undefined || cur[key] === null) {
      cur[key] = nextIsIndex ? [] : {};
    }
    cur = cur[key] as Record<string, unknown>;
  }
  cur[keys[keys.length - 1]] = value;
}
