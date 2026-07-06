import type { TemplateCtx } from '../component.js';
import { effect } from '../effect.js';
import { createScope, disposeScope, onDispose, runInScope, type Scope } from '../scope.js';

export function renderIf(
  parent: Node,
  anchor: Node,
  cond: () => unknown,
  whenTrue: (ctx: TemplateCtx) => Node,
  whenFalse: ((ctx: TemplateCtx) => Node) | null,
  ctx: TemplateCtx,
): void {
  // A persistent end-marker bounds this region: teardown removes everything
  // between `anchor` and `end`, so dynamically-inserted nested nodes (e.g. a
  // child `<for>`'s rows) are removed too — not just the statically-mounted node.
  const end = document.createTextNode('');
  parent.insertBefore(end, anchor.nextSibling);

  let branch: 'then' | 'else' | 'none' = 'none';
  let scope: Scope | null = null;

  const teardown = (): void => {
    if (scope) { disposeScope(scope); scope = null; }
    while (anchor.nextSibling && anchor.nextSibling !== end) {
      parent.removeChild(anchor.nextSibling);
    }
  };
  onDispose(teardown);

  effect(() => {
    const truthy = !!cond();
    const next = truthy ? 'then' : whenFalse ? 'else' : 'none';
    if (next === branch) return;
    teardown();
    if (next !== 'none') {
      scope = createScope();
      const factory = next === 'then' ? whenTrue : whenFalse!;
      // Run the branch factory inside its scope so nested effects register here.
      const node = runInScope(scope, () => factory(ctx));
      parent.insertBefore(node, end);
    }
    branch = next;
  });
}
