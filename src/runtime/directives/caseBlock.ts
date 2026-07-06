import type { TemplateCtx } from '../component.js';
import { effect } from '../effect.js';
import { createScope, disposeScope, onDispose, runInScope, type Scope } from '../scope.js';

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
  const end = document.createTextNode('');
  parent.insertBefore(end, anchor.nextSibling);

  let currentIndex = -1;
  let scope: Scope | null = null;

  const teardown = (): void => {
    if (scope) { disposeScope(scope); scope = null; }
    while (anchor.nextSibling && anchor.nextSibling !== end) {
      parent.removeChild(anchor.nextSibling);
    }
  };
  onDispose(teardown);

  effect(() => {
    const value = subject();
    let matchedIndex = arms.findIndex((a) => a.match !== CASE_DEFAULT && a.match === value);
    if (matchedIndex === -1) matchedIndex = arms.findIndex((a) => a.match === CASE_DEFAULT);
    if (matchedIndex === currentIndex) return;
    teardown();
    if (matchedIndex !== -1) {
      scope = createScope();
      const node = runInScope(scope, () => arms[matchedIndex].factory(ctx));
      parent.insertBefore(node, end);
    }
    currentIndex = matchedIndex;
  });
}
