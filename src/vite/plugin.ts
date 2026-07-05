import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
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

  /** Maps a dotted specifier to an absolute file path (throws on miss). Null if not dotted. */
  function resolveSpecifier(id: string): string | null {
    if (!isDottedSpecifier(id)) return null;
    const result = resolveDottedModule(id, config, configRoot);
    if (!result.path) throw dottedMissError(id, result, configPath);
    return result.path;
  }

  /** Compiles a `.dtx`/`.md` source, enforcing unique tags. Null if not a component source. */
  function transform(code: string, id: string): { code: string; map: string | null } | null {
    if (!isComponentSource(id)) return null;
    const compiled = compileModule(id, code);
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
    return { code: out, map: opts.sourceMaps === false ? null : compiled.map };
  }

  return {
    root, configPath, configRoot, config, tags, resolveSpecifier, transform,
    getCss: (id: string) => cssModules.get(id.replace(/^\0/, '')),
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
    name: 'uidetox',
    enforce: 'pre',
    resolveId(id: string): string | null {
      // Virtual CSS ids are returned with a leading \0 so Vite treats them as virtual.
      if (isVirtualCssId(id)) return id.startsWith('\0') ? id : '\0' + id;
      return core.resolveSpecifier(id);
    },
    load(id: string): string | null {
      if (isVirtualCssId(id)) return core.getCss(id) ?? null;
      return null;
    },
    transform(code: string, id: string) {
      return core.transform(code, id);
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
  // esbuild/Vitest has no virtual-CSS resolver; keep styles inline unless asked.
  const core = createUidetoxCore({ extractCss: false, ...opts });
  return {
    name: 'uidetox',
    setup(build) {
      build.onResolve({ filter: /^[A-Za-z][\w-]*(?:\.[\w-]+)+$/ }, (args) => {
        const path = core.resolveSpecifier(args.path);
        return path ? { path } : null;
      });
      build.onLoad({ filter: /\.(dtx|md)$/ }, (args) => {
        const source = readFileSync(args.path, 'utf8');
        const out = core.transform(source, args.path);
        return out ? { contents: out.code, loader: 'js' } : null;
      });
    },
  };
}

export { generateTsShim };
