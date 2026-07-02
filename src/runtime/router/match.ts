export interface MatchResult {
  rawParams: Record<string, string>;
  catchAll?: string;
}

function split(path: string): string[] {
  if (path === '/') return [''];
  if (path === '') return [];
  const trimmed = path.startsWith('/') ? path.slice(1) : path;
  return trimmed.split('/');
}

export function matchPath(pattern: string, url: string): MatchResult | null {
  const pSegs = split(pattern);
  const uSegs = split(url);
  const rawParams: Record<string, string> = {};

  let i = 0;
  while (i < pSegs.length) {
    const p = pSegs[i];
    if (p === '**') {
      const remaining = uSegs.slice(i).join('/');
      return { rawParams, catchAll: remaining };
    }
    const isOptional = p.startsWith(':') && p.endsWith('?');
    if (i >= uSegs.length) {
      if (isOptional) { i++; continue; }
      return null;
    }
    const u = uSegs[i];
    if (p.startsWith(':')) {
      const name = isOptional ? p.slice(1, -1) : p.slice(1);
      if (u === '' && !isOptional) return null;
      if (u !== '') rawParams[name] = u;
      i++;
      continue;
    }
    if (p !== u) return null;
    i++;
  }
  if (i < uSegs.length) return null;
  return { rawParams };
}

export function specificity(pattern: string): [number, number, number] {
  const segs = split(pattern);
  let staticCount = 0;
  let catchAllCount = 0;
  for (const s of segs) {
    if (s === '**') catchAllCount = 1;
    else if (!s.startsWith(':')) staticCount++;
  }
  return [segs.length, staticCount, catchAllCount];
}
