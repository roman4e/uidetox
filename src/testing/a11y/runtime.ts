import axeCore from 'axe-core';

export interface AxeResult {
  violations: Array<{ id: string; description: string; nodes: unknown[] }>;
}

interface AxeAdapter {
  run: (
    context: Node | Document | undefined,
    options: Record<string, unknown>,
  ) => Promise<AxeResult>;
}

const adapter = axeCore as unknown as AxeAdapter;

export async function axe(root?: Node): Promise<AxeResult> {
  const target = root ?? document;
  const result = await adapter.run(target, { resultTypes: ['violations'] });
  return { violations: result.violations };
}
