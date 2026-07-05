// OpenAPI 3.1 → typed UIDetox HTTP client generator.
// Pure: takes a parsed OpenAPI document, returns a self-contained TS module.

export interface OpenApiDoc {
  components?: { schemas?: Record<string, JsonSchema> };
  paths?: Record<string, PathItem>;
}

type PathItem = Record<string, Operation>;

interface Operation {
  operationId?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: {
    required?: boolean;
    content?: Record<string, { schema?: JsonSchema }>;
  };
  responses?: Record<string, { content?: Record<string, { schema?: JsonSchema }> }>;
}

interface Parameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  schema?: JsonSchema;
}

export interface JsonSchema {
  $ref?: string;
  type?: string | string[];
  format?: string;
  enum?: unknown[];
  const?: unknown;
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  allOf?: JsonSchema[];
  nullable?: boolean;
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

function camel(s: string): string {
  return s
    .replace(/[^A-Za-z0-9]+(.)?/g, (_, c: string) => (c ? c.toUpperCase() : ''))
    .replace(/^([A-Z])/, (m) => m.toLowerCase());
}

function pascal(s: string): string {
  const c = camel(s);
  return c.charAt(0).toUpperCase() + c.slice(1);
}

function refName(ref: string): string {
  // Sanitise names like `NutrientAmount-Input` (FastAPI separate_input_output_schemas)
  // so a `$ref` matches its generated interface name.
  return pascal(ref.split('/').pop() ?? 'unknown');
}

function litType(v: unknown): string {
  return typeof v === 'string' ? JSON.stringify(v) : String(v);
}

/** Prints a TS type expression for a JSON Schema. */
export function typeOf(schema: JsonSchema | undefined): string {
  if (!schema) return 'unknown';
  if (schema.$ref) return refName(schema.$ref);
  if (schema.const !== undefined) return litType(schema.const);
  if (schema.enum) return schema.enum.map(litType).join(' | ') || 'never';
  if (schema.allOf) return schema.allOf.map(typeOf).join(' & ');
  if (schema.oneOf) return schema.oneOf.map(typeOf).join(' | ');
  if (schema.anyOf) return schema.anyOf.map(typeOf).join(' | ');

  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  const nonNull = types.filter((t) => t !== 'null');
  const nullable = schema.nullable || types.includes('null');

  const base = ((): string => {
    const t = nonNull[0];
    switch (t) {
      case 'string': return 'string';
      case 'integer':
      case 'number': return 'number';
      case 'boolean': return 'boolean';
      case 'array': return `${typeOf(schema.items)}[]`;
      case 'object':
      case undefined: {
        if (schema.properties) return objectType(schema);
        if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
          return `Record<string, ${typeOf(schema.additionalProperties)}>`;
        }
        if (schema.additionalProperties === true) return 'Record<string, unknown>';
        return t === 'object' ? 'Record<string, unknown>' : 'unknown';
      }
      default: return 'unknown';
    }
  })();

  return nullable ? `${base} | null` : base;
}

function objectType(schema: JsonSchema): string {
  const req = new Set(schema.required ?? []);
  const props = Object.entries(schema.properties ?? {}).map(([key, val]) => {
    const opt = req.has(key) ? '' : '?';
    const safeKey = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
    return `  ${safeKey}${opt}: ${typeOf(val)};`;
  });
  return props.length ? `{\n${props.join('\n')}\n}` : 'Record<string, never>';
}

function jsonSchemaOf(content: Record<string, { schema?: JsonSchema }> | undefined): JsonSchema | undefined {
  return content?.['application/json']?.schema;
}

function successResponse(op: Operation): JsonSchema | undefined {
  const responses = op.responses ?? {};
  const code = Object.keys(responses).find((c) => c.startsWith('2')) ?? 'default';
  return jsonSchemaOf(responses[code]?.content);
}

interface MethodGen {
  tag: string;
  name: string;
  paramsType: string;
  hasParams: boolean;
  returnType: string;
  httpMethod: string;
  path: string;
  pathKeys: string[];
  queryKeys: string[];
  hasBody: boolean;
}

function buildMethod(path: string, method: string, op: Operation): MethodGen {
  const params = op.parameters ?? [];
  const pathParams = params.filter((p) => p.in === 'path');
  const queryParams = params.filter((p) => p.in === 'query');
  const bodySchema = jsonSchemaOf(op.requestBody?.content);
  const bodyRequired = op.requestBody?.required ?? false;

  const members: string[] = [];
  if (pathParams.length) {
    const inner = pathParams
      .map((p) => `${p.name}: ${typeOf(p.schema) === 'unknown' ? 'string | number' : typeOf(p.schema)}`)
      .join('; ');
    members.push(`path: { ${inner} }`);
  }
  if (queryParams.length) {
    const inner = queryParams
      .map((p) => `${p.name}${p.required ? '' : '?'}: ${typeOf(p.schema)}`)
      .join('; ');
    members.push(`query${queryParams.some((p) => p.required) ? '' : '?'}: { ${inner} }`);
  }
  if (bodySchema) {
    members.push(`body${bodyRequired ? '' : '?'}: ${typeOf(bodySchema)}`);
  }

  const paramsType = members.length ? `{ ${members.join('; ')} }` : '{}';
  const tag = camel(op.tags?.[0] ?? 'default');
  const name = camel(op.operationId ?? `${method}_${path}`);

  return {
    tag,
    name,
    paramsType,
    hasParams: members.length > 0,
    returnType: successResponse(op) ? typeOf(successResponse(op)) : 'void',
    httpMethod: method.toUpperCase(),
    path,
    pathKeys: pathParams.map((p) => p.name),
    queryKeys: queryParams.map((p) => p.name),
    hasBody: !!bodySchema,
  };
}

/** Generates a self-contained typed API client module from an OpenAPI document. */
export function generateApiClient(doc: OpenApiDoc): string {
  const lines: string[] = [];
  lines.push('// AUTO-GENERATED by `uidetox openapi`. Do not edit by hand.');
  lines.push("import { createHttpClient, type HttpClientOptions } from 'uidetox/http';");
  lines.push('');

  // Named schema types.
  const schemas = doc.components?.schemas ?? {};
  for (const [name, schema] of Object.entries(schemas)) {
    const printed = typeOf(schema);
    if (printed.startsWith('{')) {
      lines.push(`export interface ${pascal(name)} ${printed}`);
    } else {
      lines.push(`export type ${pascal(name)} = ${printed};`);
    }
    lines.push('');
  }

  // Collect methods grouped by tag.
  const methods: MethodGen[] = [];
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const op = item[method];
      if (op) methods.push(buildMethod(path, method, op));
    }
  }

  const byTag = new Map<string, MethodGen[]>();
  for (const m of methods) {
    if (!byTag.has(m.tag)) byTag.set(m.tag, []);
    byTag.get(m.tag)!.push(m);
  }

  // Client interface.
  lines.push('export interface ApiClient {');
  for (const [tag, ms] of byTag) {
    lines.push(`  ${tag}: {`);
    for (const m of ms) {
      const arg = m.hasParams ? `params: ${m.paramsType}` : 'params?: {}';
      lines.push(`    ${m.name}(${arg}): Promise<${m.returnType}>;`);
    }
    lines.push('  };');
  }
  lines.push('}');
  lines.push('');

  // Factory.
  lines.push('export function createClient(baseUrl: string, opts?: HttpClientOptions): ApiClient {');
  lines.push('  const http = createHttpClient(baseUrl, opts);');
  lines.push('  return {');
  for (const [tag, ms] of byTag) {
    lines.push(`    ${tag}: {`);
    for (const m of ms) {
      const call: string[] = [];
      if (m.pathKeys.length) call.push('path: params.path');
      if (m.queryKeys.length) call.push('query: params.query');
      if (m.hasBody) call.push('body: params.body');
      const reqArg = call.length ? `, { ${call.join(', ')} }` : '';
      lines.push(
        `      ${m.name}: (params: ${m.paramsType} = {} as never) =>`
        + ` http.request<${m.returnType}>('${m.httpMethod}', '${m.path}'${reqArg}),`,
      );
    }
    lines.push('    },');
  }
  lines.push('  };');
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}
