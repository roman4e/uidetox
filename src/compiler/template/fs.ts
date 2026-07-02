import { readFileSync } from 'node:fs';

export class IncludeCycleError extends Error {
  constructor(public readonly chain: string[]) {
    super(`Include cycle detected: ${chain.join(' → ')}`);
    this.name = 'IncludeCycleError';
  }
}

export class IncludeResolver {
  readonly maxDepth: number;
  private stack: string[] = [];
  private cache = new Map<string, string>();

  constructor(opts: { maxDepth?: number } = {}) {
    this.maxDepth = opts.maxDepth ?? 10;
  }

  enter(absPath: string): void {
    if (this.stack.includes(absPath)) {
      throw new IncludeCycleError([...this.stack, absPath]);
    }
    if (this.stack.length >= this.maxDepth) {
      throw new Error(`Max include depth (${this.maxDepth}) exceeded`);
    }
    this.stack.push(absPath);
  }

  leave(absPath: string): void {
    const top = this.stack.pop();
    if (top !== absPath) {
      throw new Error(`leave() mismatch: ${absPath} vs ${top}`);
    }
  }

  read(absPath: string): string {
    let content = this.cache.get(absPath);
    if (content === undefined) {
      content = readFileSync(absPath, 'utf8');
      this.cache.set(absPath, content);
    }
    return content;
  }
}
