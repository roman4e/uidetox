// Instance cleanup sink. During a component's boot the host installs its
// disposer array here so free functions (resource, mutation, http calls)
// created in `script`/`boot` can register teardown that runs on unmount.

let sink: Array<() => void> | null = null;

export function setCleanupSink(next: Array<() => void> | null): void {
  sink = next;
}

/** Registers a teardown callback with the current component instance, if any. */
export function onCleanup(fn: () => void): void {
  sink?.push(fn);
}
