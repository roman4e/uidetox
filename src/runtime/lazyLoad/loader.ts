export interface LoaderCache {
  load(url: string): Promise<unknown>;
  clear(): void;
}

export function createLoaderCache(
  importer: (url: string) => Promise<unknown> = (u) => import(/* @vite-ignore */ u),
): LoaderCache {
  const inflight = new Map<string, Promise<unknown>>();
  return {
    load(url) {
      let p = inflight.get(url);
      if (!p) {
        p = importer(url);
        inflight.set(url, p);
      }
      return p;
    },
    clear() {
      inflight.clear();
    },
  };
}
