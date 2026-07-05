import { compile } from '../compiler/compile.js';
import { compileDtx } from '../compiler/dtx/index.js';
import { buildLineMap } from './sourcemap.js';

export interface CompiledModule {
  code: string;
  map: string | null;
  /** The component's custom-element tag, or null (traits/filters/routers). */
  tag: string | null;
}

export function isComponentSource(id: string): boolean {
  return id.endsWith('.dtx') || id.endsWith('.md');
}

function extractTag(code: string): string | null {
  const m = /\btag:\s*"([^"]+)"/.exec(code);
  return m ? m[1] : null;
}

/** Compiles a `.dtx` or `.md` source string to an ESM module. */
export function compileModule(id: string, source: string): CompiledModule {
  if (id.endsWith('.dtx')) {
    const { code, map } = compileDtx(source);
    return { code, map, tag: extractTag(code) };
  }
  if (id.endsWith('.md')) {
    const { js, tag } = compile(source);
    // The Markdown compiler has no source map; anchor generated lines to the .md.
    return { code: js, map: JSON.stringify(buildLineMap(id, source, js)), tag };
  }
  throw new Error(`uidetox: cannot compile ${id} (expected .dtx or .md)`);
}
