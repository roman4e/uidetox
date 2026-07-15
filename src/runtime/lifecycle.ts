// Instance cleanup sink. During a component's boot the host installs its
// disposer array here so free functions (resource, mutation, http calls)
// created in `script`/`boot` can register teardown that runs on unmount.

let sink: Array<() => void> | null = null;

export function setCleanupSink(next: Array<() => void> | null): void {
  sink = next;
}

/**
 * Registers a teardown callback that runs when the current component instance
 * disconnects. Call it during `script`/`boot`. Register several — they run in
 * registration order. A no-op (with a warning) when called outside a component.
 */
export function onCleanup(fn: () => void): void {
  if (!sink) {
    // eslint-disable-next-line no-console
    console.warn('[ui-detox] onCleanup() called outside a component boot — ignored.');
    return;
  }
  sink.push(fn);
}
