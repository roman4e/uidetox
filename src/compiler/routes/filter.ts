import { classDslToRegex } from './charClasses.js';

export function emitFilter(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('[[') && trimmed.endsWith(']]')) {
    const re = classDslToRegex(trimmed);
    return re.toString();
  }
  if (trimmed.startsWith('/') && trimmed.lastIndexOf('/') > 0) {
    return trimmed;
  }
  const exprMatch = /^\$\{([\s\S]+)\}$/.exec(trimmed);
  if (exprMatch) return exprMatch[1].trim();
  return trimmed;
}
