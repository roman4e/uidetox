import { describe, expect, it } from 'vitest';
import { generateApiClient, typeOf } from '../../../src/compiler/openapi/generate.js';

describe('typeOf', () => {
  it('maps primitives and refs', () => {
    expect(typeOf({ type: 'string' })).toBe('string');
    expect(typeOf({ type: 'integer' })).toBe('number');
    expect(typeOf({ $ref: '#/components/schemas/Ingredient' })).toBe('Ingredient');
    expect(typeOf({ type: 'array', items: { type: 'string' } })).toBe('string[]');
  });

  it('maps enums to string-literal unions', () => {
    expect(typeOf({ type: 'string', enum: ['a', 'b'] })).toBe('"a" | "b"');
  });

  it('maps oneOf to a union (discriminated)', () => {
    expect(typeOf({ oneOf: [{ $ref: '#/x/A' }, { $ref: '#/x/B' }] })).toBe('A | B');
    // FastAPI separate_input_output_schemas hyphenated names → valid TS identifiers
    expect(typeOf({ $ref: '#/components/schemas/NutrientAmount-Input' })).toBe('NutrientAmountInput');
  });

  it('handles nullable via type array', () => {
    expect(typeOf({ type: ['string', 'null'] })).toBe('string | null');
  });
});

const doc = {
  components: {
    schemas: {
      Ingredient: {
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          density: { type: 'number' },
        },
      },
      Category: { type: 'string', enum: ['vegetable', 'meat'] },
    },
  },
  paths: {
    '/v1/ingredients': {
      get: {
        operationId: 'listIngredients',
        tags: ['ingredients'],
        parameters: [
          { name: 'query', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          '200': { content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Ingredient' } } } } },
        },
      },
      post: {
        operationId: 'createIngredient',
        tags: ['ingredients'],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Ingredient' } } } },
        responses: { '201': { content: { 'application/json': { schema: { $ref: '#/components/schemas/Ingredient' } } } } },
      },
    },
    '/v1/dish/{id}': {
      get: {
        operationId: 'getDish',
        tags: ['dishes'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string' } } } } } } },
      },
      delete: {
        operationId: 'deleteDish',
        tags: ['dishes'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '204': {} },
      },
    },
  },
};

describe('generateApiClient', () => {
  const code = generateApiClient(doc);

  it('emits named schema types', () => {
    expect(code).toContain('export interface Ingredient {');
    expect(code).toContain('id: string;');
    expect(code).toContain('density?: number;');
    expect(code).toContain('export type Category = "vegetable" | "meat";');
  });

  it('imports the http client', () => {
    expect(code).toContain("import { createHttpClient, type HttpClientOptions } from 'uidetox/http';");
  });

  it('groups typed methods by tag', () => {
    expect(code).toContain('ingredients: {');
    expect(code).toContain('listIngredients(');
    expect(code).toContain('dishes: {');
    expect(code).toContain('getDish(');
  });

  it('types the response of a list as an array', () => {
    expect(code).toMatch(/listIngredients\(.*\): Promise<Ingredient\[\]>/s);
  });

  it('wires path/query/body into http.request', () => {
    expect(code).toContain("http.request<Ingredient[]>('GET', '/v1/ingredients'");
    expect(code).toContain("http.request<Ingredient>('POST', '/v1/ingredients', { body: params.body })");
    expect(code).toContain("http.request<void>('DELETE', '/v1/dish/{id}', { path: params.path })");
  });

  it('produces a createClient factory', () => {
    expect(code).toContain('export function createClient(baseUrl: string, opts?: HttpClientOptions): ApiClient {');
    expect(code).toContain('const http = createHttpClient(baseUrl, opts);');
  });
});
