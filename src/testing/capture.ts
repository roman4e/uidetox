export function capture<T = unknown>(host: EventTarget, name: string): T[] {
  const out: T[] = [];
  host.addEventListener(name, (event) => {
    const detail = (event as CustomEvent).detail;
    out.push(detail !== undefined ? (detail as T) : (event as unknown as T));
  });
  return out;
}
