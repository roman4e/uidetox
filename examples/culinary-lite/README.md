# culinary-lite

Smoke-test Vite project for the `uidetox/vite` plugin: a router with a `.dtx`
login and dashboard, dotted-module imports resolved through `detox.toml`.

```
pnpm dev      # vite dev server, HMR on .dtx edits
pnpm build    # production ESM build
```

Key points:
- `vite.config.ts` registers `uidetox()` — nothing else needed.
- `src/main.ts` imports pages by **dotted ref** (`import Login from "pages.Login"`);
  the plugin maps them to `src/pages/Login.dtx` via `detox.toml`'s
  `resolve.includes = ["src"]`.
- Components are authored in `.dtx`; the plugin compiles them to ESM on the fly.
