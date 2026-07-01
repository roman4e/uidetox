export interface Test {
  name: string;
  fn: () => void | Promise<void>;
}

export interface Suite {
  name: string;
  hooks: { beforeEach: Array<() => void | Promise<void>> };
  tests: Test[];
  suites: Suite[];
}

function makeSuite(name: string): Suite {
  return { name, hooks: { beforeEach: [] }, tests: [], suites: [] };
}

let root: Suite = makeSuite('__root__');
let stack: Suite[] = [root];

function current(): Suite {
  return stack[stack.length - 1];
}

export function describe(name: string, fn: () => void): void {
  const suite = makeSuite(name);
  current().suites.push(suite);
  stack.push(suite);
  try {
    fn();
  } finally {
    stack.pop();
  }
}

export function it(name: string, fn: () => void | Promise<void>): void {
  current().tests.push({ name, fn });
}

export function beforeEach(fn: () => void | Promise<void>): void {
  current().hooks.beforeEach.push(fn);
}

export function getCollectedTree(): Suite {
  const previous = root;
  root = makeSuite('__root__');
  stack = [root];
  return previous;
}
