export interface HandlerLike {
  name: string | null;
  run(this: unknown, ...args: unknown[]): unknown;
}

interface HandlerCarrier {
  handlers?: Record<string, HandlerLike[]>;
  off?: Record<string, string[] | 'all'>;
}

export function mergeHandlers(mro: HandlerCarrier[]): Record<string, HandlerLike[]> {
  const events = new Set<string>();
  for (const item of mro) if (item.handlers) for (const e of Object.keys(item.handlers)) events.add(e);
  const result: Record<string, HandlerLike[]> = {};
  const offAll = new Set<string>();
  const offNames = new Map<string, Set<string>>();
  for (const item of mro) {
    if (!item.off) continue;
    for (const [event, spec] of Object.entries(item.off)) {
      if (spec === 'all') offAll.add(event);
      else {
        if (!offNames.has(event)) offNames.set(event, new Set());
        for (const n of spec) offNames.get(event)!.add(n);
      }
    }
  }
  for (const event of events) {
    if (offAll.has(event)) {
      const own = mro[0]?.handlers?.[event] ?? [];
      result[event] = own;
      continue;
    }
    const chain: HandlerLike[] = [];
    for (let i = mro.length - 1; i >= 0; i--) {
      const list = mro[i].handlers?.[event] ?? [];
      for (const h of list) {
        if (h.name && offNames.get(event)?.has(h.name)) continue;
        chain.push(h);
      }
    }
    result[event] = chain;
  }
  return result;
}

interface ChainCarrier<T> {
  transformers?: T[];
  offTransform?: string[] | 'all';
}

export function mergeChain<T>(mro: ChainCarrier<T>[], nameOf: (t: T) => string | null): T[] {
  const offAll = mro.some((m) => m.offTransform === 'all');
  const offNames = new Set<string>();
  for (const m of mro) {
    if (Array.isArray(m.offTransform)) for (const n of m.offTransform) offNames.add(n);
  }
  if (offAll) {
    return mro[0]?.transformers ?? [];
  }
  const out: T[] = [];
  for (let i = mro.length - 1; i >= 0; i--) {
    const list = mro[i].transformers ?? [];
    for (const t of list) {
      const name = nameOf(t);
      if (name && offNames.has(name)) continue;
      out.push(t);
    }
  }
  return out;
}
