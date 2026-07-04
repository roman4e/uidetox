export type DragEventType = 'drag:start' | 'drag:move' | 'drag:end' | 'drag:cancel';

export interface DragDetail {
  payload: unknown;
  clientX: number;
  clientY: number;
  source: Element;
}

/** Broadcasts a drag lifecycle event on document.body (the shared drag bus). */
export function emitDrag(type: DragEventType, detail: DragDetail): void {
  document.body.dispatchEvent(new CustomEvent(type, { detail }));
}

/** Reads a draggable payload from a source element (property or JSON data-attr). */
export function readPayload(el: Element): unknown {
  const anyEl = el as unknown as Record<string, unknown>;
  if (anyEl.dragPayload !== undefined) return anyEl.dragPayload;
  if (anyEl['drag-payload'] !== undefined) return anyEl['drag-payload'];
  const raw = (el as HTMLElement).dataset?.payload;
  if (raw !== undefined) {
    try { return JSON.parse(raw); } catch { return raw; }
  }
  return undefined;
}

export function setBodyDragging(active: boolean): void {
  if (active) document.body.dataset.dragging = 'true';
  else delete document.body.dataset.dragging;
}
