import { dirname } from 'node:path';
import { compile } from '../compiler/compile.js';
import { compileDtx } from '../compiler/dtx/index.js';
import { buildLineMap } from './sourcemap.js';

export interface CompiledModule {
  code: string;
  map: string | null;
  /** The component's custom-element tag, or null (traits/filters/routers). */
  tag: string | null;
}

export interface CompileOptions {
  /** Resolver include roots + extensions (from detox.toml) for user imports. */
  includes?: string[];
  extensions?: string[];
}

export function isComponentSource(id: string): boolean {
  return id.endsWith('.dtx') || id.endsWith('.md');
}

function extractTag(code: string): string | null {
  const m = /\btag:\s*"([^"]+)"/.exec(code);
  return m ? m[1] : null;
}

/** Compiles a `.dtx` or `.md` source string to an ESM module. */
export function compileModule(id: string, source: string, opts: CompileOptions = {}): CompiledModule {
  if (id.endsWith('.dtx')) {
    // Pass the importer's directory + resolver config so USER imports resolve
    // (bare npm verbatim, dotted/local → correct project-relative paths).
    const { code, map } = compileDtx(source, {
      baseDir: dirname(id),
      includes: opts.includes,
      extensions: opts.extensions,
    });
    return { code, map, tag: extractTag(code) };
  }
  if (id.endsWith('.md')) {
    const { js, tag } = compile(source);
    // The Markdown compiler has no source map; anchor generated lines to the .md.
    return { code: js, map: JSON.stringify(buildLineMap(id, source, js)), tag };
  }
  throw new Error(`uidetox: cannot compile ${id} (expected .dtx or .md)`);
}
