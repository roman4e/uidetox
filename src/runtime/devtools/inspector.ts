/**
 * Runtime instrumentation for DevTools panel.
 *
 * `inspectComponentTree(root)` walks the DOM under `root` and returns a
 * serialisable snapshot of every UIDetox Custom Element (kebab-case tag),
 * including its attributes and children — enough for a devtools panel to
 * render a tree view.
 */

export interface ComponentNode {
  tag: string;
  attrs: Record<string, string>;
  children: ComponentNode[];
}

function isCustomElement(el: Element): boolean {
  return el.tagName.includes('-');
}

function walk(el: Element): ComponentNode {
  const attrs: Record<string, string> = {};
  for (const a of Array.from(el.attributes)) attrs[a.name] = a.value;
  const children: ComponentNode[] = [];
  for (const child of Array.from(el.children)) {
    if (isCustomElement(child)) children.push(walk(child));
    else {
      // dive into non-custom containers for their custom-element descendants
      for (const grand of Array.from(child.getElementsByTagName('*'))) {
        if (isCustomElement(grand) && grand.parentElement === child) {
          children.push(walk(grand));
        }
      }
    }
  }
  return { tag: el.tagName.toLowerCase(), attrs, children };
}

export function inspectComponentTree(root: Element): ComponentNode[] {
  const out: ComponentNode[] = [];
  for (const child of Array.from(root.children)) {
    if (isCustomElement(child)) out.push(walk(child));
  }
  return out;
}
