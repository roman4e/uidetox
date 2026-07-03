export class InconsistentHierarchyError extends Error {
  constructor(reason: string) {
    super(`Inconsistent hierarchy: ${reason}`);
    this.name = 'InconsistentHierarchyError';
  }
}

export interface Linearizable<T> {
  name: string;
  extends?: T[];
}

const CACHE = Symbol.for('uidetox.mro');

function merge<T>(sequences: T[][]): T[] {
  const result: T[] = [];
  const lists = sequences.map((s) => [...s]).filter((s) => s.length > 0);
  while (lists.length > 0) {
    let head: T | null = null;
    for (const seq of lists) {
      const candidate = seq[0];
      const inTail = lists.some((other) => other.slice(1).includes(candidate));
      if (!inTail) { head = candidate; break; }
    }
    if (head === null) {
      const residual = lists.map((s) => s.map((x) => (x as { name?: string }).name ?? String(x)).join(',')).join(' | ');
      throw new InconsistentHierarchyError(`no valid head, residual: ${residual}`);
    }
    result.push(head);
    for (const seq of lists) {
      if (seq[0] === head) seq.shift();
    }
    for (let i = lists.length - 1; i >= 0; i--) {
      if (lists[i].length === 0) lists.splice(i, 1);
    }
  }
  return result;
}

export function resolveLinearization<T extends Linearizable<T>>(root: T): T[] {
  const cached = (root as { [k: symbol]: T[] })[CACHE];
  if (cached) return cached;
  const parents = root.extends ?? [];
  const parentLins = parents.map((p) => resolveLinearization(p));
  const list = [root, ...merge<T>([...parentLins, [...parents]])];
  Object.defineProperty(root, CACHE, { value: list, enumerable: false, configurable: false, writable: false });
  return list;
}
