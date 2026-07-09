# REQ-27 — Public component-cleanup hook for `.dtx` `script`

**Type:** feature
**Priority:** medium
**Requested by:** SOPP/ALP frontend (realtime board + artifact card)

## Problem

A `.dtx` component that opens a long-lived resource in its `script` block — a
WebSocket, an interval, an event listener on `window` — has no supported way to
release it when the component is removed from the DOM (e.g. the router swaps
pages). `onCleanup` exists in `src/runtime/lifecycle.ts` and is used internally
by `http/resource.ts`, but it is **not re-exported** from the `uidetox` runtime
entry (`src/runtime/index.ts`), so component code cannot call it.

Today we work around this with a module-level singleton that tears down the
previous subscription when the next component mounts (see
`sopp-frontend/src/lib/boardLive.ts`). That works only because at most one such
component is visible at a time; it does not generalize, and it keeps the socket
open after navigating away to an unrelated page.

## Request

Re-export a component-scoped cleanup registrar from the `uidetox` entry so
`script`/`actions` code can register teardown that runs on unmount:

```ts
import onCleanup from "uidetox";   // bare -> named import { onCleanup }

script
const sub = watch(["project:" + props.projectId], liveReload);
onCleanup(() => sub.stop());
end script
```

Semantics we need:

1. Callback runs exactly once when the component instance is disconnected.
2. Runs in the component's reactive scope (same scope `state`/`effect` use), so
   registration during the `script` phase binds to the right instance.
3. Safe to register several; they run LIFO (or any defined order).
4. No-op / warning (not throw) if called outside a component scope.

If a distinct name is preferred (`onDispose`, `onUnmount`), that's fine — we
only need one public, documented hook. Please also add its `.d.ts` type to the
plugin-generated shims so `tsc` sees it for bare `.dtx` imports.

## Impact

Lets components own their side effects and release them deterministically,
removing the single-instance workaround and preventing leaked sockets/intervals
on navigation.
