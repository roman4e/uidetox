// String-catalog stub. Translation is out of MVP scope; `t` returns the key
// unchanged so consumer call sites don't need rewriting when a catalog arrives.

let catalog: Record<string, string> | null = null;

export function setCatalog(next: Record<string, string> | null): void {
  catalog = next;
}

export function t(key: string): string {
  return catalog?.[key] ?? key;
}
