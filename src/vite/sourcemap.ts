// Minimal v3 source map: anchors each generated line to a source line (identity,
// clamped). Precision within a line is not attempted — enough for DevTools to
// show the original .md/.dtx under the compiled output.

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function encodeVlq(value: number): string {
  let v = value < 0 ? (-value << 1) | 1 : value << 1;
  let out = '';
  do {
    let digit = v & 31;
    v >>>= 5;
    if (v > 0) digit |= 32;
    out += B64[digit];
  } while (v > 0);
  return out;
}

export interface SourceMap {
  version: 3;
  sources: string[];
  sourcesContent: string[];
  names: string[];
  mappings: string;
}

/** Builds an identity line-anchor source map from `source` to `generated`. */
export function buildLineMap(id: string, source: string, generated: string): SourceMap {
  const srcLines = source.split('\n').length;
  const genLines = generated.split('\n').length;
  let prevSrcLine = 0;
  const rows: string[] = [];
  for (let i = 0; i < genLines; i++) {
    const srcLine = Math.min(i, srcLines - 1);
    // segment fields: [genCol=0, srcFile Δ=0, srcLine Δ, srcCol Δ=0]
    rows.push(encodeVlq(0) + encodeVlq(0) + encodeVlq(srcLine - prevSrcLine) + encodeVlq(0));
    prevSrcLine = srcLine;
  }
  return {
    version: 3,
    sources: [id],
    sourcesContent: [source],
    names: [],
    mappings: rows.join(';'),
  };
}
