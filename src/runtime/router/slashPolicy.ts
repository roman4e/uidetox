export type SlashPolicy = 'strict' | 'narrowing' | 'expanding';

export interface SlashFallback {
  url: string;
}

export function applySlashPolicy(
  policy: SlashPolicy,
  url: string,
  tryMatch: (u: string) => boolean,
): SlashFallback | null {
  if (policy === 'strict') return null;
  if (policy === 'narrowing') {
    if (url === '/' || !url.endsWith('/')) return null;
    const alt = url.slice(0, -1);
    return tryMatch(alt) ? { url: alt } : null;
  }
  if (url.endsWith('/')) return null;
  const alt = url + '/';
  return tryMatch(alt) ? { url: alt } : null;
}
