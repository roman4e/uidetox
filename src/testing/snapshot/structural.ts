import { AssertionError } from '../expect.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

interface SnapshotConfig {
  componentDir: string;
  updateMode: boolean;
}

let config: SnapshotConfig | null = null;

export function configureSnapshots(opts: SnapshotConfig): void {
  config = opts;
}

function attrString(attrs: NamedNodeMap): string {
  const pairs = [...attrs].map((a) => [a.name, a.value] as const);
  pairs.sort(([a], [b]) => a.localeCompare(b));
  return pairs.map(([n, v]) => ` ${n}="${v.replace(/"/g, '&quot;')}"`).join('');
}

function serializeNode(node: Node, depth: number, out: string[]): void {
  const indent = '  '.repeat(depth);
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent ?? '').trim();
    if (text) out.push(`${indent}${text}`);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  const attrs = attrString(el.attributes);
  if (el.childNodes.length === 0) {
    out.push(`${indent}<${tag}${attrs}/>`);
    return;
  }
  out.push(`${indent}<${tag}${attrs}>`);
  for (const child of Array.from(el.childNodes)) serializeNode(child, depth + 1, out);
  out.push(`${indent}</${tag}>`);
}

export function serializeDom(root: Node): string {
  const out: string[] = [];
  for (const child of Array.from(root.childNodes)) serializeNode(child, 0, out);
  return out.join('\n');
}

async function readBaseline(path: string): Promise<string | null> {
  try {
    return await fs.readFile(path, 'utf8');
  } catch {
    return null;
  }
}

export async function snapshot(name: string, options?: { root?: Node }): Promise<void> {
  if (!config) throw new AssertionError('snapshot(): no config set; runner must call configureSnapshots()');
  const root = options?.root ?? document.body;
  const serialized = serializeDom(root);
  const path = join(config.componentDir, `${name}.snap.txt`);
  const baseline = await readBaseline(path);
  if (baseline === null) {
    if (!config.updateMode) {
      throw new AssertionError(
        `snapshot(${name}): no baseline. Rerun with --update-snapshots to create ${path}.`,
      );
    }
    await fs.mkdir(config.componentDir, { recursive: true });
    await fs.writeFile(path, serialized, 'utf8');
    return;
  }
  if (baseline !== serialized) {
    if (config.updateMode) {
      await fs.writeFile(path, serialized, 'utf8');
      return;
    }
    throw new AssertionError(
      `snapshot(${name}): mismatch\n---baseline---\n${baseline}\n---actual---\n${serialized}`,
    );
  }
}
