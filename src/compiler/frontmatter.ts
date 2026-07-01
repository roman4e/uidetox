import { parse as parseYaml } from 'yaml';

export function extractFrontmatter(source: string): {
  frontmatter: Record<string, unknown>;
  rest: string;
} {
  if (!source.startsWith('---\n') && !source.startsWith('---\r\n')) {
    return { frontmatter: {}, rest: source };
  }
  const end = source.indexOf('\n---', 4);
  if (end === -1) return { frontmatter: {}, rest: source };
  const raw = source.slice(4, end);
  const parsed = parseYaml(raw);
  const frontmatter =
    parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {};
  const restStart = source.indexOf('\n', end + 4);
  const rest = restStart === -1 ? '' : source.slice(restStart + 1);
  return { frontmatter, rest };
}
