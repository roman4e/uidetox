import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runOpenApi } from '../../src/cli/build.js';

const spec = {
  paths: {
    '/v1/me': {
      get: {
        operationId: 'getMe',
        tags: ['auth'],
        responses: { '200': { content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string' } } } } } } },
      },
    },
  },
};

describe('uidetox openapi', () => {
  it('reads a spec file and writes a typed client module', async () => {
    const root = mkdtempSync(join(tmpdir(), 'uidetox-oapi-'));
    const input = join(root, 'openapi.json');
    const output = join(root, 'api.ts');
    writeFileSync(input, JSON.stringify(spec));
    await runOpenApi({ input, output });
    const code = readFileSync(output, 'utf8');
    expect(code).toContain("from 'uidetox/http'");
    expect(code).toContain('auth: {');
    expect(code).toContain('getMe(');
    expect(code).toContain('export function createClient');
  });
});
