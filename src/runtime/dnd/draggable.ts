import { emitDrag, readPayload, setBodyDragging, type DragDetail } from './bus.js';

export interface DraggableParams {
  handle?: string;
  threshold?: number;
  axis?: 'x' | 'y';
  ghost?: 'clone' | 'none' | string;
  longPress?: number;
}

interface PointerLike {
  clientX?: number;
  clientY?: number;
  pointerType?: string;
  target?: EventTarget | null;
  key?: string;
  preventDefault?: () => void;
}

function coord(e: PointerLike): { x: number; y: number } {
  return { x: e.clientX ?? 0, y: e.clientY ?? 0 };
}

/** Attaches draggable-source behavior to an element via Pointer Events. */
export function attachDraggable(el: Element, params: DraggableParams = {}): () => void {
  const threshold = params.threshold ?? 4;
  const longPress = params.longPress ?? 300;
  const host = el as HTMLElement;
  host.style.touchAction = 'none';

  let startX = 0;
  let startY = 0;
  let dragging = false;
  let armed = false;
  let ghost: HTMLElement | null = null;
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;

  const detailAt = (x: number, y: number): DragDetail => ({
    payload: readPayload(el),
    clientX: x,
    clientY: y,
    source: el,
  });

  function makeGhost(x: number, y: number): void {
    const mode = params.ghost ?? 'clone';
    if (mode === 'none') return;
    const template = mode === 'clone' ? el : document.querySelector(mode);
    if (!template) return;
    ghost = template.cloneNode(true) as HTMLElement;
    ghost.classList.add('dragging');
    ghost.style.position = 'fixed';
    ghost.style.pointerEvents = 'none';
    ghost.style.left = `${x}px`;
    ghost.style.top = `${y}px`;
    document.body.appendChild(ghost);
  }

  function moveGhost(x: number, y: number): void {
    if (!ghost) return;
    if (params.axis !== 'y') ghost.style.left = `${x}px`;
    if (params.axis !== 'x') ghost.style.top = `${y}px`;
  }

  function startDrag(x: number, y: number): void {
    dragging = true;
    setBodyDragging(true);
    makeGhost(x, y);
    const detail = detailAt(x, y);
    el.dispatchEvent(new CustomEvent('drag:start', { detail }));
    emitDrag('drag:start', detail);
  }

  function endDrag(type: 'drag:end' | 'drag:cancel', x: number, y: number): void {
    if (!dragging) { teardownActive(); return; }
    dragging = false;
    const detail = detailAt(x, y);
    emitDrag(type, detail);
    el.dispatchEvent(new CustomEvent(type, { detail }));
    ghost?.remove();
    ghost = null;
    setBodyDragging(false);
    teardownActive();
  }

  function onPointerMove(e: Event): void {
    const p = e as unknown as PointerLike;
    const { x, y } = coord(p);
    if (!dragging) {
      if (!armed) return;
      if (Math.hypot(x - startX, y - startY) >= threshold) startDrag(x, y);
      return;
    }
    moveGhost(x, y);
    emitDrag('drag:move', detailAt(x, y));
  }

  function onPointerUp(e: Event): void {
    const { x, y } = coord(e as unknown as PointerLike);
    endDrag('drag:end', x, y);
  }

  function onPointerCancel(e: Event): void {
    const { x, y } = coord(e as unknown as PointerLike);
    endDrag('drag:cancel', x, y);
  }

  function onKeyDown(e: Event): void {
    if ((e as unknown as PointerLike).key === 'Escape' && dragging) {
      endDrag('drag:cancel', startX, startY);
    }
  }

  function teardownActive(): void {
    armed = false;
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerCancel);
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('visibilitychange', onVisibility);
  }

  function onVisibility(): void {
    if (dragging) endDrag('drag:cancel', startX, startY);
  }

  function onPointerDown(e: Event): void {
    const p = e as unknown as PointerLike;
    if (params.handle) {
      const target = p.target as Element | null;
      if (!target || !target.closest(params.handle) || !el.contains(target)) return;
    }
    const { x, y } = coord(p);
    startX = x;
    startY = y;
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerCancel);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', onVisibility);
    if (p.pointerType === 'touch') {
      // Require a long-press before arming touch drags (so scrolling still works).
      longPressTimer = setTimeout(() => { armed = true; }, longPress);
    } else {
      armed = true;
    }
  }

  el.addEventListener('pointerdown', onPointerDown);
  return () => {
    el.removeEventListener('pointerdown', onPointerDown);
    if (dragging) endDrag('drag:cancel', startX, startY);
    else teardownActive();
  };
}
