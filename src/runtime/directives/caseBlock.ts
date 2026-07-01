import type { TemplateCtx } from '../component.js';
import { effect } from '../effect.js';

export const CASE_DEFAULT = Symbol('uidetox.case.default');

export interface CaseArm {
  match: unknown | typeof CASE_DEFAULT;
  factory: (ctx: TemplateCtx) => Node;
}

export function renderCase(
  parent: Node,
  anchor: Node,
  subject: () => unknown,
  arms: CaseArm[],
  ctx: TemplateCtx,
): void {
  let currentIndex = -1;
  let currentNode: Node | null = null;
  effect(() => {
    const value = subject();
    let matchedIndex = arms.findIndex(
      (a) => a.match !== CASE_DEFAULT && a.match === value,
    );
    if (matchedIndex === -1) {
      matchedIndex = arms.findIndex((a) => a.match === CASE_DEFAULT);
    }
    if (matchedIndex === currentIndex) return;
    if (currentNode) currentNode.parentNode?.removeChild(currentNode);
    currentNode = matchedIndex === -1 ? null : arms[matchedIndex].factory(ctx);
    if (currentNode) parent.insertBefore(currentNode, anchor.nextSibling);
    currentIndex = matchedIndex;
  });
}
