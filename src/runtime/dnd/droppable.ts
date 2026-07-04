import type { DragDetail } from './bus.js';

export interface DroppableParams {
  accept?: string;
  autoScroll?: boolean;
}

interface PayloadWithKind {
  kind?: unknown;
}

function accepts(accept: string | undefined, payload: unknown): boolean {
  if (!accept) return true;
  const kinds = accept.split(',').map((s) => s.trim()).filter(Boolean);
  if (!kinds.length) return true;
  const kind = (payload as PayloadWithKind)?.kind;
  return typeof kind === 'string' && kinds.includes(kind);
}

function within(el: Element, x: number, y: number): boolean {
  const r = el.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

/** Attaches drop-target behavior: highlights on hover, emits `drop-payload` on drop. */
export function attachDroppable(el: Element, params: DroppableParams = {}): () => void {
  const host = el as HTMLElement;

  const isActive = (detail: DragDetail): boolean =>
    accepts(params.accept, detail.payload) && within(el, detail.clientX, detail.clientY);

  const maybeAutoScroll = (detail: DragDetail): void => {
    if (!params.autoScroll) return;
    const r = el.getBoundingClientRect();
    const edge = 40;
    if (detail.clientY < r.top + edge) host.scrollTop -= edge;
    else if (detail.clientY > r.bottom - edge) host.scrollTop += edge;
  };

  const onMove = (e: Event): void => {
    const detail = (e as CustomEvent<DragDetail>).detail;
    if (isActive(detail)) {
      host.dataset.dropActive = 'true';
      maybeAutoScroll(detail);
    } else {
      delete host.dataset.dropActive;
    }
  };

  const onEnd = (e: Event): void => {
    const detail = (e as CustomEvent<DragDetail>).detail;
    const wasActive = isActive(detail);
    delete host.dataset.dropActive;
    if (!wasActive) return;
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new CustomEvent('drop-payload', {
      detail: {
        payload: detail.payload,
        clientX: detail.clientX,
        clientY: detail.clientY,
        offsetX: detail.clientX - r.left,
        offsetY: detail.clientY - r.top,
      },
    }));
  };

  const onCancel = (): void => { delete host.dataset.dropActive; };

  document.body.addEventListener('drag:move', onMove);
  document.body.addEventListener('drag:end', onEnd);
  document.body.addEventListener('drag:cancel', onCancel);
  return () => {
    document.body.removeEventListener('drag:move', onMove);
    document.body.removeEventListener('drag:end', onEnd);
    document.body.removeEventListener('drag:cancel', onCancel);
  };
}
