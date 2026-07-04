# Culinary → UIDetox Feature Requests — Batch 01

**Status:** OPEN

## Batch scope

Dev-time toolchain — plugins/loaders and dotted-module resolution — needed to run
a real `culinary-frontend` (multi-page, `.dtx`-only, `detox.toml` resolver) under
Vite with HMR. Without this the frontend cannot start dev.

## Requests

| # | Request | Priority | Blocks |
|---|---|---|---|
| 08 | Vite plugin (`uidetox/vite`) — load `.dtx` and `.md`, HMR, dotted-module resolve | **P0** | Any dev session of `culinary-frontend` |
