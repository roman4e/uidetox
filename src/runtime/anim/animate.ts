import { prefersReducedMotion } from './reducedMotion.js';

export interface AnimateOptions {
  duration?: number;
  easing?: string;
  delay?: number;
  fill?: 'none' | 'forwards' | 'backwards' | 'both';
}

/**
 * Thin wrapper over the Web Animations API. Returns the Animation, or null when
 * WAAPI is unavailable or the user prefers reduced motion. In the reduced /
 * unavailable case, the final keyframe's styles are applied instantly.
 */
export function animate(
  el: Element,
  keyframes: Keyframe[],
  opts: AnimateOptions = {},
): Animation | null {
  const canAnimate = typeof (el as unknown as { animate?: unknown }).animate === 'function';
  if (prefersReducedMotion() || !canAnimate) {
    const last = keyframes[keyframes.length - 1];
    if (last) {
      const style = (el as HTMLElement).style as unknown as Record<string, string>;
      for (const [k, v] of Object.entries(last)) {
        if (k === 'offset' || k === 'easing' || k === 'composite') continue;
        style[k] = String(v);
      }
    }
    return null;
  }
  return (el as unknown as { animate: (kf: Keyframe[], o: AnimateOptions) => Animation }).animate(
    keyframes,
    { duration: opts.duration ?? 200, easing: opts.easing ?? 'ease', delay: opts.delay, fill: opts.fill },
  );
}
