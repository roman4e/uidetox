let currentHost: HTMLElement | null = null;

export function setCurrentHost(host: HTMLElement | null): void {
  currentHost = host;
}

export function defineEmits<T extends Record<string, unknown>>() {
  const host = currentHost;
  if (!host) {
    throw new Error('defineEmits() must be called during boot()');
  }
  return function emit<K extends keyof T & string>(name: K, detail?: T[K]): void {
    host.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  };
}
