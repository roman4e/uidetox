import type { TemplateCtx } from '../component.js';
import { effect } from '../effect.js';

const FRAGMENT_NODE = 11; // Node.DOCUMENT_FRAGMENT_NODE

/** The real nodes a factory produced (a fragment's children move out on insert). */
function realNodes(node: Node): Node[] {
  return node.nodeType === FRAGMENT_NODE ? Array.from(node.childNodes) : [node];
}

export function renderIf(
  parent: Node,
  anchor: Node,
  cond: () => unknown,
  whenTrue: (ctx: TemplateCtx) => Node,
  whenFalse: ((ctx: TemplateCtx) => Node) | null,
  ctx: TemplateCtx,
): void {
  let currentNodes: Node[] = [];
  let currentBranch: 'then' | 'else' | 'none' = 'none';
  effect(() => {
    const truthy = !!cond();
    const nextBranch = truthy ? 'then' : whenFalse ? 'else' : 'none';
    if (nextBranch === currentBranch) return;
    // Remove the previously mounted branch — its actual DOM nodes, not the
    // (now-empty) fragment they came from.
    for (const n of currentNodes) n.parentNode?.removeChild(n);
    currentNodes = [];
    const node = nextBranch === 'then' ? whenTrue(ctx) : nextBranch === 'else' && whenFalse ? whenFalse(ctx) : null;
    if (node) {
      currentNodes = realNodes(node); // capture BEFORE insert empties a fragment
      parent.insertBefore(node, anchor.nextSibling);
    }
    currentBranch = nextBranch;
  });
}
