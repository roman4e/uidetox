import { parseFragment } from 'parse5';
import type { TplAttr, TplNode } from './ast.js';

const INTERP = /\$\{([^}]+)\}/;
const BINDING_ATTR = /^\$\{([^}]+)\}$/;

function classifyAttr(name: string, rawValue: string): TplAttr {
  const stripped = rawValue.trim();
  const binding = BINDING_ATTR.exec(stripped);
  if (name.startsWith('@')) {
    return { name, kind: 'event', value: binding ? binding[1].trim() : stripped };
  }
  if (name.startsWith('.')) {
    return { name, kind: 'property', value: binding ? binding[1].trim() : stripped };
  }
  if (name.startsWith('?')) {
    return { name, kind: 'boolean', value: binding ? binding[1].trim() : stripped };
  }
  if (binding) {
    return { name, kind: 'expression', value: binding[1].trim() };
  }
  return { name, kind: 'static', value: rawValue };
}

function splitTextWithInterpolations(text: string): TplNode[] {
  const nodes: TplNode[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const rest = text.slice(cursor);
    const match = INTERP.exec(rest);
    if (!match) {
      if (rest.length > 0) nodes.push({ type: 'text', value: rest });
      break;
    }
    if (match.index > 0) {
      nodes.push({ type: 'text', value: rest.slice(0, match.index) });
    }
    nodes.push({ type: 'interpolation', expression: match[1].trim() });
    cursor += match.index + match[0].length;
  }
  return nodes;
}

// parse5 lowercases tag names. Recover author casing by scanning source.
function collectAuthorCasing(source: string): Map<number, string> {
  const casing = new Map<number, string>();
  const rx = /<\s*([A-Za-z][\w-]*)/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(source)) !== null) {
    casing.set(m.index, m[1]);
  }
  return casing;
}

interface P5Element {
  nodeName: string;
  tagName?: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: P5Element[];
  sourceCodeLocation?: { startTag?: { startOffset: number }; startOffset?: number };
  value?: string;
}

function convert(node: P5Element, casedByOffset: Map<number, string>): TplNode[] {
  if (node.nodeName === '#text') {
    return splitTextWithInterpolations(node.value ?? '');
  }
  if (node.tagName) {
    const offset =
      node.sourceCodeLocation?.startTag?.startOffset ??
      node.sourceCodeLocation?.startOffset;
    const authorTag =
      (offset !== undefined ? casedByOffset.get(offset) : undefined) ??
      node.tagName;
    const attrs: TplAttr[] = (node.attrs ?? []).map((a) =>
      classifyAttr(a.name, a.value),
    );
    const children: TplNode[] = [];
    for (const child of node.childNodes ?? []) {
      children.push(...convert(child, casedByOffset));
    }
    return [{ type: 'element', tag: authorTag, attrs, children }];
  }
  const kids: TplNode[] = [];
  for (const child of node.childNodes ?? []) {
    kids.push(...convert(child, casedByOffset));
  }
  return kids;
}

export function parseTemplate(source: string): TplNode[] {
  const casedByOffset = collectAuthorCasing(source);
  const fragment = parseFragment(source, { sourceCodeLocationInfo: true });
  const out: TplNode[] = [];
  for (const child of (fragment as unknown as { childNodes: P5Element[] }).childNodes) {
    out.push(...convert(child, casedByOffset));
  }
  return out;
}
