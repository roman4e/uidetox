export class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssertionError';
  }
}

function eq(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!eq((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  }
  return true;
}

function stringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

let snapshotHandler: ((name: string, value: unknown) => void) | null = null;

export interface Assertion {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toContain(needle: unknown): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toBeNull(): void;
  toBeUndefined(): void;
  toHaveLength(n: number): void;
  toBeGreaterThan(n: number): void;
  toThrow(match?: string | RegExp): void;
  toHaveNoViolations(): void;
  toMatchSnapshot(name?: string): void;
}

function assertion(actual: unknown): Assertion {
  return {
    toBe(expected) {
      if (!Object.is(actual, expected)) {
        throw new AssertionError(`toBe: expected ${stringify(expected)}, got ${stringify(actual)}`);
      }
    },
    toEqual(expected) {
      if (!eq(actual, expected)) {
        throw new AssertionError(`toEqual: expected ${stringify(expected)}, got ${stringify(actual)}`);
      }
    },
    toContain(needle) {
      if (typeof actual === 'string' && typeof needle === 'string') {
        if (!actual.includes(needle)) {
          throw new AssertionError(`toContain: ${stringify(actual)} does not include ${stringify(needle)}`);
        }
        return;
      }
      if (Array.isArray(actual)) {
        if (!actual.some((x) => eq(x, needle))) {
          throw new AssertionError(`toContain: array does not include ${stringify(needle)}`);
        }
        return;
      }
      throw new AssertionError('toContain: subject must be string or array');
    },
    toBeTruthy() {
      if (!actual) throw new AssertionError(`toBeTruthy: value was ${stringify(actual)}`);
    },
    toBeFalsy() {
      if (actual) throw new AssertionError(`toBeFalsy: value was ${stringify(actual)}`);
    },
    toBeNull() {
      if (actual !== null) throw new AssertionError(`toBeNull: value was ${stringify(actual)}`);
    },
    toBeUndefined() {
      if (actual !== undefined) throw new AssertionError(`toBeUndefined: value was ${stringify(actual)}`);
    },
    toHaveLength(n) {
      const len = (actual as { length?: number })?.length;
      if (len !== n) throw new AssertionError(`toHaveLength: expected ${n}, got ${stringify(len)}`);
    },
    toBeGreaterThan(n) {
      if (typeof actual !== 'number' || !(actual > n)) {
        throw new AssertionError(`toBeGreaterThan: ${stringify(actual)} is not > ${n}`);
      }
    },
    toThrow(match) {
      if (typeof actual !== 'function') throw new AssertionError('toThrow: subject must be a function');
      try {
        (actual as () => unknown)();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (match === undefined) return;
        if (typeof match === 'string' && !message.includes(match)) {
          throw new AssertionError(`toThrow: message ${stringify(message)} did not include ${stringify(match)}`);
        }
        if (match instanceof RegExp && !match.test(message)) {
          throw new AssertionError(`toThrow: message ${stringify(message)} did not match ${String(match)}`);
        }
        return;
      }
      throw new AssertionError('toThrow: function did not throw');
    },
    toHaveNoViolations() {
      const violations = (actual as { violations?: unknown[] })?.violations;
      if (!violations || violations.length === 0) return;
      throw new AssertionError(`toHaveNoViolations: ${violations.length} violation(s): ${stringify(violations)}`);
    },
    toMatchSnapshot(name?: string) {
      if (!snapshotHandler) {
        throw new AssertionError('toMatchSnapshot: no snapshot handler registered');
      }
      snapshotHandler(name ?? 'default', actual);
    },
  };
}

const rootExpect = (actual: unknown) => assertion(actual);
(rootExpect as unknown as { setSnapshotHandler: (fn: typeof snapshotHandler) => void }).setSnapshotHandler =
  (fn) => { snapshotHandler = fn; };

export const expect = rootExpect as ((actual: unknown) => Assertion) & {
  setSnapshotHandler: (fn: typeof snapshotHandler) => void;
};
