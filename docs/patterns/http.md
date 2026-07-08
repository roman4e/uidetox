# Pattern: HTTP client + typed API layer

`uidetox/http` provides a typed HTTP client, a reactive `resource()`, and a
`mutation()` helper. `uidetox openapi` generates a fully-typed client from a
FastAPI/OpenAPI 3.1 document. No runtime dependencies.

## Codegen

```
uidetox openapi --input ./openapi.json --output ./src/generated/api.ts
```

Produces named types from `components.schemas`, an `ApiClient` interface with
methods grouped by tag, and a `createClient(baseUrl, opts)` factory:

```ts
import { createClient } from './generated/api';
import { registry, createToken } from 'uidetox';

export const apiToken = createToken<ReturnType<typeof createClient>>('api');

const api = createClient('/api/v1', {
  auth: {
    getAccessToken: () => tokenStore.access,
    onRefresh: async () => {
      const r = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' });
      const { access } = await r.json();
      tokenStore.access = access;
      return access;
    },
  },
  onAuthExpired: () => location.assign('/login'),
});
registry.provide(apiToken, api);
```

## Client behaviour

- **Query serialization** — primitives, arrays (repeat-key `?tag=a&tag=b`),
  nested objects (dot-notation `?filter.min=0`); `null`/`undefined` omitted.
- **Auth** — `getAccessToken()` sets `Authorization: Bearer …` per request.
- **401 refresh** — a single in-flight `onRefresh`, concurrent 401s queue behind
  it, the original request retries once. A second 401 (or failed refresh) calls
  `onAuthExpired`.
- **Errors** — a non-2xx response throws an `ApiError`
  (`status`, `code?`, `message`, `fieldErrors?`). FastAPI `detail[]` folds into
  `fieldErrors`.
- **Interceptors** — `{ onRequest(ctx), onResponse(res, ctx) }` hooks.

## Reactive resource

```ts
import { resource } from 'uidetox/http';

const query = state({ text: '', category: null });
const list = resource(
  (signal) => api.ingredients.list({ query, signal }),
  { key: () => JSON.stringify(query) },
);
// list.status  'idle' | 'loading' | 'success' | 'error'
// list.loading, list.data, list.error, list.reload(), list.abort()
```

Re-runs when the reactive reads in `key` change, aborts the previous request on
each run, and **auto-aborts when the host component disconnects**.

```html
<case on=${list.status}>
  <when is="loading"><spinner/></when>
  <when is="error"><alert msg=${list.error?.message}/></when>
  <else>
    <for each=${list.data.items} item="ing" key="ing.id"><ingredient-row data=${ing}/></for>
  </else>
</case>
```

## Mutations (optimistic + rollback)

```ts
import { mutation } from 'uidetox/http';

const patch = mutation(
  (id: string, body: Partial<Ingredient>) => api.ingredients.update({ path: { id }, body }),
  {
    onOptimistic: (id, body) => { const item = list.data?.items.find(i => i.id === id); const prev = { ...item }; Object.assign(item!, body); return prev; },
    onRollback: (prev, id) => { const item = list.data?.items.find(i => i.id === id); Object.assign(item!, prev); },
    onSuccess: () => list.reload(),
  },
);
// patch.pending, patch.error
```

## Form integration

Server-side validation errors flow straight into a form:

```ts
try {
  await api.ingredients.create({ body: fm.values });
} catch (err) {
  if (err instanceof ApiError) fm.applyServerErrors(err);
}
```

`fm.applyServerErrors` merges `err.fieldErrors` into the form error map;
each error clears when its field is next edited.

## Commands (CQRS)

`command()` dispatches a named write to a commands endpoint with idempotency and
optimistic rollback — the write-side companion to `resource()`.

```ts
import { command } from 'uidetox/http';

const reorder = command(
  (a: { artifact: string; rank: string }) => ({
    command: 'artifact.reorder',
    payload: { artifact: `artifact:${a.artifact}`, rank: a.rank },
  }),
  {
    client: api,                 // §18 http client → 401-refresh + ApiError
    endpoint: '/api/commands',
    idempotent: true,            // auto-mint idempotency_key (default)
    optimistic: (a, patch) => { patch.prev = list.data; applyMove(a); },
    rollback:   (_a, patch) => { list.data = patch.prev; },
  },
);

await reorder.run({ artifact, rank });  // resolves on ack, rolls back + rejects on error
reorder.pending;  // reactive — bind ?disabled=${reorder.pending}
reorder.error;
```

Posts `{ command, payload, idempotency_key? }`. `optimistic` runs before the
request (stash undo on `patch`), `rollback` on any failure.
