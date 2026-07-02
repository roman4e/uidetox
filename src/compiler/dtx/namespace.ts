const KEBAB_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export function kebabToCamel(name: string): string {
  return name.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

export function isKebabName(name: string): boolean {
  return KEBAB_RE.test(name);
}
