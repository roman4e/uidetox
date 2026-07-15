import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { loadConfig } from '../compiler/dtx/resolve.js';
import { compileModule, isComponentSource } from './compile.js';
import { createTagRegistry } from './tags.js';
import {
  isDottedSpecifier,
  resolveDottedModule,
  dottedMissError,
} from './resolve.js';
import { generateTsShim } from './shim.js';
import {
  extractStyleSource,
  scopeCss,
  cssHash,
  virtualCssId,
  isVirtualCssId,
  stripInlineStyle,
} from './css.js';
import { extractTestBlocks, emitTestExports } from './testblocks.js';
import { writeShims } from './shims.js';

export interface UidetoxPluginOptions {
  /** Project root; defaults to process.cwd(). */
  root?: string;
  /** Path to detox.toml (default: <root>/detox.toml). */
  config?: string;
  /** Enable component-preserving HMR (v1: full route reload). Default true. */
  hmr?: boolean;
  /** Emit source maps. Default true. */
  sourceMaps?: boolean;
  /** Extract `style scoped` into Vite's CSS pipeline (virtual imports). Default true. */
  extractCss?: boolean;
  /** dev/build strip colocated test blocks; test re-emits them as `__tests`. Default 'dev'. */
  mode?: 'dev' | 'build' | 'test';
}

/** Strips a Vite query suffix (`?v=…`, `?import`) and a leading virtual `\0`. */
function cleanId(id: string): string {
  return id.replace(/^\0/, '').replace(/\?.*$/, '');
}

/** Shared core used by both the Vite and esbuild plugins. */
export function createUidetoxCore(opts: UidetoxPluginOptions = {}) {
  const root = opts.root ?? process.cwd();
  const configPath = opts.config ?? join(root, 'detox.toml');
  const configRoot = dirname(configPath);
  const config = loadConfig(configRoot);
  const tags = createTagRegistry();
  const extractCss = opts.extractCss !== false;
  /** Extracted virtual CSS, keyed by `virtual:uidetox-css/<hash>.css`. */
  const cssModules = new Map<string, string>();

  /**
   * Resolves a bare module ref (dotted `pages.Login` or single `routes`) to a
   * file. Slashed/relative specifiers are left to Vite/npm. A miss on a clearly
   * dotted (multi-segment) ref throws; a single-segment miss falls through to npm.
   */
  function resolveSpecifier(id: string): string | null {
    if (id.includes('/') || id.startsWith('.') || !/^[A-Za-z][\w.-]*$/.test(id)) return null;
    const result = resolveDottedModule(id, config, configRoot);
    if (result.path) return result.path;
    if (isDottedSpecifier(id)) throw dottedMissError(id, result, configPath);
    return null; // single-segment miss → npm/bare specifier
  }

  /** Compiles a `.dtx`/`.md` source, enforcing unique tags. Null if not a component source. */
  function transform(code: string, id: string): { code: string; map: string | null } | null {
    if (!isComponentSource(id)) return null;
    const compiled = compileModule(id, code, {
      includes: config.resolve.includes.map((inc) => (isAbsolute(inc) ? inc : join(configRoot, inc))),
      extensions: config.resolve.extensions,
    });
    tags.register(compiled.tag, id);
    let out = compiled.code;

    // Route `style [scoped]` through Vite's CSS pipeline via a virtual import.
    if (extractCss && compiled.tag) {
      const style = extractStyleSource(id, code);
      if (style && style.css) {
        const css = style.scoped ? scopeCss(style.css, compiled.tag) : style.css;
        const hash = cssHash(id, css);
        const virtualId = virtualCssId(hash);
        cssModules.set(virtualId, css);
        out = `import ${JSON.stringify(virtualId)};\n${stripInlineStyle(out)}`;
      }
    }

    // Colocated test blocks: re-emit in `test` mode, stay stripped otherwise.
    if ((opts.mode ?? 'dev') === 'test') {
      out += emitTestExports(extractTestBlocks(id, code));
    }
    return { code: out, map: opts.sourceMaps === false ? null : compiled.map };
  }

  return {
    root, configPath, configRoot, config, tags, resolveSpecifier, transform,
    getCss: (id: string) => cssModules.get(id.replace(/^\0/, '')),
    /** Writes <root>/.uidetox/dtx-shims.d.ts for `tsc --noEmit`. Returns the path. */
    writeShims: () => writeShims(root, config, configRoot),
  };
}

/**
 * Vite plugin. Loads `.dtx`/`.md` as ESM, resolves dotted module refs via
 * detox.toml, and (v1) does a full route reload on component edits.
 */
export function uidetox(opts: UidetoxPluginOptions = {}): Record<string, unknown> {
  const core = createUidetoxCore(opts);
  const hmr = opts.hmr !== false;
  return {
    name: 'ui-detox',
    enforce: 'pre',
    buildStart() {
      // Emit ambient TS shims so `tsc --noEmit` resolves dotted imports.
      try { core.writeShims(); } catch { /* non-fatal */ }
    },
    resolveId(id: string): string | null {
      // Virtual CSS ids are returned with a leading \0 so Vite treats them as virtual.
      if (isVirtualCssId(id)) return id.startsWith('\0') ? id : '\0' + id;
      return core.resolveSpecifier(id);
    },
    load(id: string): string | null {
      if (isVirtualCssId(id)) return core.getCss(id) ?? null;
      // Vite won't load non-JS extensions as modules on its own, so `transform`
      // never fires for `.dtx`/`.md`. Provide the source here; `transform` compiles it.
      const file = cleanId(id);
      if (isComponentSource(file)) return readFileSync(file, 'utf8');
      return null;
    },
    transform(code: string, id: string) {
      return core.transform(code, cleanId(id));
    },
    handleHotUpdate(ctx: { file: string; server?: { ws?: { send(p: unknown): void } } }) {
      if (hmr && isComponentSource(ctx.file)) {
        ctx.server?.ws?.send({ type: 'full-reload' });
        return [];
      }
      return undefined;
    },
  };
}

interface EsbuildArgs { path: string; importer?: string }
interface EsbuildBuild {
  onResolve(filter: { filter: RegExp }, cb: (a: EsbuildArgs) => { path: string } | null): void;
  onLoad(filter: { filter: RegExp }, cb: (a: EsbuildArgs) => { contents: string; loader: string } | null): void;
}

/**
 * esbuild plugin (used by non-Vite toolchains: Vitest, Storybook, custom bundlers).
 * The Vite plugin covers the same ground with richer HMR.
 */
export function uidetoxEsbuild(opts: UidetoxPluginOptions = {}): { name: string; setup(build: EsbuildBuild): void } {
  // esbuild is the Vitest bridge: keep styles inline (no CSS resolver) and
  // re-emit colocated test blocks so the runner can execute them.
  const core = createUidetoxCore({ extractCss: false, mode: 'test', ...opts });
  return {
    name: 'ui-detox',
    setup(build) {
      // Any bare specifier (dotted `pages.Login` or single `routes`); a miss
      // returns null so esbuild falls through to node_modules for npm packages.
      build.onResolve({ filter: /^[A-Za-z][\w.-]*$/ }, (args) => {
        const path = core.resolveSpecifier(args.path);
        return path ? { path } : null;
      });
      // Fire in the scan phase too, so component sources are compiled before
      // esbuild parses them as JS (avoids raw-DSL leaking bare imports).
      build.onLoad({ filter: /\.(dtx|md)$/ }, (args) => {
        const source = readFileSync(cleanId(args.path), 'utf8');
        const out = core.transform(source, cleanId(args.path));
        return out ? { contents: out.code, loader: 'js' } : null;
      });
    },
  };
}

export { generateTsShim };
