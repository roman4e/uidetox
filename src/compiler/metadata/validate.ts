import { PAGE_INTERFACE_FIELDS, isInterfaceName, type InterfaceName } from './interfaces.js';

const ALL_FIELDS = new Set<string>();
for (const list of Object.values(PAGE_INTERFACE_FIELDS)) for (const f of list) ALL_FIELDS.add(f);

function requiredInterfaceFor(field: string): InterfaceName {
  for (const [iface, fields] of Object.entries(PAGE_INTERFACE_FIELDS) as [InterfaceName, string[]][]) {
    if (fields.includes(field)) return iface;
  }
  throw new Error(`Field ${field} maps to no interface`);
}

export interface MetadataResult {
  errors: string[];
  warnings: string[];
  declared: Record<string, unknown>;
}

export function validateMetadata(frontmatter: Record<string, unknown>): MetadataResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const declared: Record<string, unknown> = {};

  const rawExtends = frontmatter.extends;
  const extendsList: InterfaceName[] = [];
  if (Array.isArray(rawExtends)) {
    for (const item of rawExtends as string[]) {
      if (!isInterfaceName(item)) {
        errors.push(`unknown interface: ${item}`);
        continue;
      }
      if (extendsList.includes(item)) {
        warnings.push(`duplicate interface: ${item}`);
      } else {
        extendsList.push(item);
      }
    }
  }
  const allowedFields = new Set<string>();
  for (const iface of extendsList) {
    for (const f of PAGE_INTERFACE_FIELDS[iface]) allowedFields.add(f);
  }

  for (const [key, value] of Object.entries(frontmatter)) {
    if (key === 'extends' || key === 'name' || key === 'tag') continue;
    if (!ALL_FIELDS.has(key)) continue;
    if (!allowedFields.has(key)) {
      errors.push(`field "${key}" requires ${requiredInterfaceFor(key)} in extends`);
      continue;
    }
    declared[key] = value;
  }

  return { errors, warnings, declared };
}
