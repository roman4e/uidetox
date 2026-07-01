import { extractFrontmatter } from './frontmatter.js';

export interface SfcBlock {
  lang: string;
  role: string;
  content: string;
  line: number;
}

export interface Sfc {
  frontmatter: Record<string, unknown>;
  body: string;
  blocks: SfcBlock[];
}

const FENCE_OPEN = /^```([A-Za-z][\w-]*)(?:\s+([A-Za-z][\w:-]*))?\s*$/;
const FENCE_CLOSE = /^```\s*$/;

export function parseSfc(source: string): Sfc {
  const { frontmatter, rest } = extractFrontmatter(source);
  const lines = rest.split('\n');
  const blocks: SfcBlock[] = [];
  const bodyLines: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const openMatch = FENCE_OPEN.exec(lines[i]);
    if (openMatch && openMatch[2]) {
      const lang = openMatch[1];
      const role = openMatch[2];
      const startLine = i + 1;
      const contentLines: string[] = [];
      i++;
      while (i < lines.length && !FENCE_CLOSE.test(lines[i])) {
        contentLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push({
        lang,
        role,
        content: contentLines.join('\n'),
        line: startLine,
      });
    } else {
      bodyLines.push(lines[i]);
      i++;
    }
  }
  return { frontmatter, body: bodyLines.join('\n'), blocks };
}
