import { scheduleRender } from '../scheduler.js';

export type PropKind = 'text' | 'attr' | 'prop' | 'boolean' | 'style';

interface PropOp {
  node: Node;
  kind: PropKind;
  name: string;
  value: unknown;
}

export type StructuralOp =
  | { kind: 'insert'; parent: Node; node: Node; before: Node | null }
  | { kind: 'remove'; node: Node }
  | { kind: 'move'; parent: Node; node: Node; before: Node | null };

const propOps = new Map<string, PropOp>();
const propKeyByNode = new WeakMap<Node, number>();
let nodeSeq = 0;
const structuralOps: StructuralOp[] = [];
let commitScheduled = false;

function nodeId(node: Node): number {
  let id = propKeyByNode.get(node);
  if (id === undefined) {
    id = ++nodeSeq;
    propKeyByNode.set(node, id);
  }
  return id;
}

function keyOf(node: Node, kind: PropKind, name: string): string {
  return `${nodeId(node)}:${kind}:${name}`;
}

function ensureCommitScheduled(): void {
  if (commitScheduled) return;
  commitScheduled = true;
  scheduleRender(commitStage);
}

export function mutate(node: Node, kind: PropKind, name: string, value: unknown): void {
  propOps.set(keyOf(node, kind, name), { node, kind, name, value });
  ensureCommitScheduled();
}

export function mutateStructural(op: StructuralOp): void {
  structuralOps.push(op);
  ensureCommitScheduled();
}

export function readStaged(node: Node, kind: PropKind, name: string): unknown | undefined {
  const op = propOps.get(keyOf(node, kind, name));
  return op ? op.value : undefined;
}

function applyProp(op: PropOp): void {
  if (op.kind === 'text') {
    (op.node as Text).data = String(op.value ?? '');
    return;
  }
  const el = op.node as HTMLElement;
  if (op.kind === 'attr') {
    const v = op.value;
    if (v === false || v === null || v === undefined) el.removeAttribute(op.name);
    else el.setAttribute(op.name, String(v));
  } else if (op.kind === 'prop') {
    (el as unknown as Record<string, unknown>)[op.name] = op.value;
  } else if (op.kind === 'boolean') {
    if (op.value) el.setAttribute(op.name, '');
    else el.removeAttribute(op.name);
  } else if (op.kind === 'style') {
    (el.style as unknown as Record<string, string>)[op.name] = String(op.value ?? '');
  }
}

function applyStructural(op: StructuralOp): void {
  if (op.kind === 'insert' || op.kind === 'move') {
    op.parent.insertBefore(op.node, op.before);
  } else if (op.kind === 'remove') {
    op.node.parentNode?.removeChild(op.node);
  }
}

export function commitStage(): void {
  commitScheduled = false;
  if (propOps.size > 0) {
    const ops = [...propOps.values()];
    propOps.clear();
    for (const op of ops) applyProp(op);
  }
  if (structuralOps.length > 0) {
    const ops = structuralOps.splice(0, structuralOps.length);
    for (const op of ops) applyStructural(op);
  }
}
