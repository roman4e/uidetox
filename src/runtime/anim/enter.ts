import { animate, type AnimateOptions } from './animate.js';

// Mount-enter / unmount-exit transitions on top of `animate()` (WAAPI, reduced-
// motion aware). Framer-parallel: enter fades+slides in on first paint, exit
// plays the reverse and resolves a promise so callers can await it before
// removing the node (exit-before-enter / `<if>` teardown).

export interface EnterOptions extends AnimateOptions {
  /** Starting opacity (default 0). */
  opacity?: number;
  /** Starting Y offset in px (default 12; slides up into place). */
  y?: number;
  /** Starting X offset in px (default 0). */
  x?: number;
  /** Starting scale (default 1). */
  scale?: number;
}

function transform(x: number, y: number, scale: number): string {
  const parts: string[] = [];
  if (x || y) parts.push(`translate(${x}px, ${y}px)`);
  if (scale !== 1) parts.push(`scale(${scale})`);
  return parts.length ? parts.join(' ') : 'none';
}

function frames(o: EnterOptions): { from: Keyframe; to: Keyframe } {
  const from: Keyframe = {
    opacity: o.opacity ?? 0,
    transform: transform(o.x ?? 0, o.y ?? 12, o.scale ?? 1),
  };
  const to: Keyframe = { opacity: 1, transform: 'none' };
  return { from, to };
}

/** Enter-on-mount transition. Returns the Animation (or null when reduced/unsupported). */
export function enter(el: Element, opts: EnterOptions = {}): Animation | null {
  const { from, to } = frames(opts);
  return animate(el, [from, to], { duration: 300, easing: 'ease-out', ...opts });
}

/**
 * Exit transition (reverse of {@link enter}). Resolves when the animation
 * finishes — await it before removing the node. Resolves immediately under
 * reduced motion / no WAAPI.
 */
export function exit(el: Element, opts: EnterOptions = {}): Promise<void> {
  const { from, to } = frames(opts);
  const anim = animate(el, [to, from], { duration: 200, easing: 'ease-in', fill: 'forwards', ...opts });
  if (!anim) return Promise.resolve();
  return anim.finished.then(() => undefined, () => undefined);
}

/**
 * Enter a list of elements with a per-item delay (for `<for>` children).
 * `step` ms accumulates on top of `opts.delay`. Returns the started Animations.
 */
export function stagger(els: Iterable<Element>, opts: EnterOptions = {}, step = 60): Array<Animation | null> {
  const base = opts.delay ?? 0;
  const out: Array<Animation | null> = [];
  let i = 0;
  for (const el of els) {
    out.push(enter(el, { ...opts, delay: base + i * step }));
    i++;
  }
  return out;
}

/**
 * Exit-before-enter coordinator (`AnimatePresence mode="wait"` equivalent):
 * play the outgoing element's exit, run `swap()` to mutate the DOM, then enter
 * the element `swap` returns. `swap` may be async.
 */
export async function presence(
  outgoing: Element | null,
  swap: () => Element | null | Promise<Element | null>,
  opts: EnterOptions = {},
): Promise<Element | null> {
  if (outgoing) await exit(outgoing, opts);
  const incoming = await swap();
  if (incoming) enter(incoming, opts);
  return incoming;
}
