// Thin dev/test launchers. Kept out of build.ts so the vitest transform never
// has to analyze the self-referential `import('vite')` / `import('vitest/node')`.

export interface DevOptions { root?: string; port?: number }

interface ViteLike {
  createServer(cfg: unknown): Promise<{ listen(): Promise<unknown>; printUrls(): void }>;
}
interface VitestNodeLike {
  startVitest(mode: string, filters: string[], options: unknown): Promise<unknown>;
}

/** Launches Vite with the uidetox plugin pre-configured (no vite.config needed). */
export async function runDev(opts: DevOptions = {}): Promise<void> {
  let vite: ViteLike;
  try {
    vite = (await import('vite' as string)) as unknown as ViteLike;
  } catch {
    throw new Error('`uidetox dev` requires "vite". Install it: npm i -D vite');
  }
  const uidetox = (await import('../vite/index.js')).default;
  const root = opts.root ?? process.cwd();
  const server = await vite.createServer({
    root,
    plugins: [uidetox({ root })],
    server: opts.port ? { port: opts.port } : undefined,
  });
  await server.listen();
  server.printUrls();
}

/** Runs Vitest under happy-dom with the uidetox esbuild plugin (mode: test). */
export async function runTest(opts: { root?: string } = {}): Promise<void> {
  let node: VitestNodeLike;
  try {
    node = (await import('vitest/node' as string)) as unknown as VitestNodeLike;
  } catch {
    throw new Error('`uidetox test` requires "vitest". Install it: npm i -D vitest');
  }
  const { uidetoxEsbuild } = await import('../vite/index.js');
  await node.startVitest('test', [], {
    root: opts.root ?? process.cwd(),
    environment: 'happy-dom',
    optimizeDeps: { esbuildOptions: { plugins: [uidetoxEsbuild()] } },
  });
}
