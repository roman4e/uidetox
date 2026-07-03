import { measure } from '../dom/measure.js';
import { commitStage } from '../dom/stage.js';
import { animate } from './animate.js';
import { prefersReducedMotion } from './reducedMotion.js';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FlipDelta {
  dx: number;
  dy: number;
  sx: number;
  sy: number;
}

export function computeFlipDelta(first: Rect, last: Rect): FlipDelta {
  return {
    dx: first.x - last.x,
    dy: first.y - last.y,
    sx: last.width === 0 ? 1 : first.width / last.width,
    sy: last.height === 0 ? 1 : first.height / last.height,
  };
}

export interface FlipOptions {
  duration?: number;
  easing?: string;
}

function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
}

function isTrivial(d: FlipDelta): boolean {
  return d.dx === 0 && d.dy === 0 && d.sx === 1 && d.sy === 1;
}

/**
 * First-Last-Invert-Play. Measures element positions, applies mutateFn,
 * measures again, and animates each element from its old position to the new.
 */
export function flip(elements: Element[], mutateFn: () => void, opts: FlipOptions = {}): void {
  const first = new Map<Element, Rect>();
  for (const el of elements) first.set(el, rectOf(el));

  mutateFn();
  commitStage();

  const reduced = prefersReducedMotion();
  for (const el of elements) {
    const f = first.get(el)!;
    const l = measure(() => rectOf(el));
    const d = computeFlipDelta(f, l);
    if (isTrivial(d) || reduced) continue;
    animate(
      el,
      [
        { transform: `translate(${d.dx}px, ${d.dy}px) scale(${d.sx}, ${d.sy})` },
        { transform: 'translate(0, 0) scale(1, 1)' },
      ],
      { duration: opts.duration ?? 200, easing: opts.easing ?? 'ease' },
    );
  }
}
