export const CHAR_CLASSES: Record<string, string> = {
  Alphabet: 'a-zA-Z',
  Numbers: '0-9',
  Alphanum: 'a-zA-Z0-9',
  Dash: '-',
  Underscore: '_',
  Dot: '.',
  Slug: 'a-z0-9-',
  Hex: '0-9a-fA-F',
  UUID: '__UUID__',
};

export function expandClassExpression(expr: string): string {
  const parts = expr.split('+').map((p) => p.trim());
  const bodies: string[] = [];
  let uuidUsed = false;
  for (const p of parts) {
    if (!(p in CHAR_CLASSES)) {
      throw new Error(`Unknown character class: ${p}`);
    }
    const body = CHAR_CLASSES[p];
    if (body === '__UUID__') {
      if (parts.length !== 1) {
        throw new Error('UUID class cannot be composed with others');
      }
      uuidUsed = true;
    } else {
      bodies.push(body);
    }
  }
  if (uuidUsed) return '[0-9a-f-]{36}';
  return `[${bodies.join('')}]`;
}

export function classDslToRegex(dsl: string): RegExp {
  const inner = dsl.replace(/^\[\[|\]\]$/g, '').trim();
  const body = expandClassExpression(inner);
  const source = body.endsWith('{36}') ? `^${body}$` : `^${body}+$`;
  return new RegExp(source);
}
