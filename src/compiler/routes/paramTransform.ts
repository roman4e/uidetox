import { emitFilter } from './filter.js';

const RESERVED = new Set(['filter', 'default', 'optional', 'name', 'type']);

export interface ParamEmit {
  name: string;
  source: string;
}

export function emitParamSchema(attrs: Array<[string, string]>): ParamEmit {
  let name: string | undefined;
  let type = 'string';
  let filter: string | undefined;
  let defaultValue: string | undefined;
  let optional = false;

  for (const [key, value] of attrs) {
    if (RESERVED.has(key)) {
      if (key === 'filter') filter = emitFilter(value);
      else if (key === 'default') defaultValue = value;
      else if (key === 'optional') optional = true;
      continue;
    }
    const cleanName = key.startsWith(':') ? key.slice(1) : key;
    if (name !== undefined) {
      throw new Error(`<param> may declare only one :name binding; got ${name} and ${cleanName}`);
    }
    name = cleanName;
    type = value;
  }
  if (name === undefined) {
    throw new Error('<param> requires a :name binding');
  }

  const parts: string[] = [`type: ${JSON.stringify(type)}`, `optional: ${optional ? 'true' : 'false'}`];
  if (filter) parts.push(`filter: ${filter}`);
  if (defaultValue !== undefined) parts.push(`default: ${JSON.stringify(defaultValue)}`);
  return { name, source: `{ ${parts.join(', ')} }` };
}
