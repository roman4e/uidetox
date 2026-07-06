import type { TemplateCtx } from '../component.js';
import { effect } from '../effect.js';

export const CASE_DEFAULT = Symbol('uidetox.case.default');

export interface CaseArm {
  match: unknown | typeof CASE_DEFAULT;
  factory: (ctx: TemplateCtx) => Node;
}

const FRAGMENT_NODE = 11; // Node.DOCUMENT_FRAGMENT_NODE

export function renderCase(
  parent: Node,
  anchor: Node,
  subject: () => unknown,
  arms: CaseArm[],
  ctx: TemplateCtx,
): void {
  let currentIndex = -1;
  let currentNodes: Node[] = [];
  effect(() => {
    const value = subject();
    let matchedIndex = arms.findIndex(
      (a) => a.match !== CASE_DEFAULT && a.match === value,
    );
    if (matchedIndex === -1) {
      matchedIndex = arms.findIndex((a) => a.match === CASE_DEFAULT);
    }
    if (matchedIndex === currentIndex) return;
    for (const n of currentNodes) n.parentNode?.removeChild(n);
    currentNodes = [];
    const node = matchedIndex === -1 ? null : arms[matchedIndex].factory(ctx);
    if (node) {
      currentNodes = node.nodeType === FRAGMENT_NODE ? Array.from(node.childNodes) : [node];
      parent.insertBefore(node, anchor.nextSibling);
    }
    currentIndex = matchedIndex;
  });
}
