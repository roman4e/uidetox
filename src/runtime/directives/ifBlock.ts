import type { TemplateCtx } from '../component.js';
import { effect } from '../effect.js';

export function renderIf(
  parent: Node,
  anchor: Node,
  cond: () => unknown,
  whenTrue: (ctx: TemplateCtx) => Node,
  whenFalse: ((ctx: TemplateCtx) => Node) | null,
  ctx: TemplateCtx,
): void {
  let currentNode: Node | null = null;
  let currentBranch: 'then' | 'else' | 'none' = 'none';
  effect(() => {
    const truthy = !!cond();
    const nextBranch = truthy ? 'then' : whenFalse ? 'else' : 'none';
    if (nextBranch === currentBranch) return;
    if (currentNode) {
      currentNode.parentNode?.removeChild(currentNode);
      currentNode = null;
    }
    if (nextBranch === 'then') currentNode = whenTrue(ctx);
    else if (nextBranch === 'else' && whenFalse) currentNode = whenFalse(ctx);
    if (currentNode) parent.insertBefore(currentNode, anchor.nextSibling);
    currentBranch = nextBranch;
  });
}
