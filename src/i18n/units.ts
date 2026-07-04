export interface UnitInput {
  symbol: string;
  /** Magnitude of one unit in the dimension's canonical base. */
  base: number;
  /** Units sharing a dimension are inter-convertible and auto-scale together. */
  dimension?: string;
  /** Legacy/explicit conversion ratios (informational; base is authoritative). */
  convertFrom?: Record<string, number>;
}

interface UnitDef {
  symbol: string;
  base: number;
  dimension: string;
}

const units = new Map<string, UnitDef>();

export function registerUnit(name: string, def: UnitInput): void {
  units.set(name, { symbol: def.symbol, base: def.base, dimension: def.dimension ?? name });
}

export function getUnit(name: string): UnitDef | undefined {
  return units.get(name);
}

export function clearUnits(): void {
  units.clear();
}

/** Converts a value between two units of the same dimension via their base ratio. */
export function convert(value: number, from: string, to: string): number {
  const f = units.get(from);
  const t = units.get(to);
  if (!f || !t) return value;
  return (value * f.base) / t.base;
}

/**
 * Picks the most readable unit in a dimension: the one where the converted value
 * lands in [0.5, 999]. Falls back to the largest unit when the value overflows,
 * the smallest when it underflows.
 */
export function bestUnit(value: number, fromName: string): string {
  const from = units.get(fromName);
  if (!from) return fromName;
  const cands = [...units.entries()]
    .filter(([, u]) => u.dimension === from.dimension)
    .sort((a, b) => b[1].base - a[1].base);
  if (!cands.length) return fromName;
  const canonical = value * from.base;
  for (const [name, u] of cands) {
    const c = canonical / u.base;
    if (c >= 0.5 && c < 1000) return name;
  }
  const [firstName, firstDef] = cands[0];
  const cFirst = canonical / firstDef.base;
  return cFirst >= 1000 ? firstName : cands[cands.length - 1][0];
}
