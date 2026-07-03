interface ViewTransitionCapable {
  startViewTransition?: (cb: () => void | Promise<void>) => { finished: Promise<void> };
}

/**
 * Runs `mutateFn` inside a browser View Transition when supported, giving an
 * automatic crossfade between the before and after states. Falls back to
 * running `mutateFn` directly.
 */
export async function viewTransition(mutateFn: () => void | Promise<void>): Promise<void> {
  const doc = (typeof document !== 'undefined' ? document : undefined) as
    | (Document & ViewTransitionCapable)
    | undefined;
  if (doc && typeof doc.startViewTransition === 'function') {
    const vt = doc.startViewTransition(mutateFn);
    await vt.finished;
    return;
  }
  await mutateFn();
}
