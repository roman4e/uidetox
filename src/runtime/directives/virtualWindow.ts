export interface WindowInput {
  scrollTop: number;
  viewportHeight: number;
  rowHeight: number;
  count: number;
  overscan: number;
}

export interface WindowResult {
  /** First rendered index (inclusive). */
  start: number;
  /** Last rendered index (exclusive). */
  end: number;
  /** Pixel offset of the first rendered row (top spacer height). */
  offsetTop: number;
  /** Total scrollable height for all rows. */
  totalHeight: number;
}

/** Pure window math for fixed-height row virtualization. */
export function computeWindow(input: WindowInput): WindowResult {
  const { scrollTop, viewportHeight, rowHeight, count, overscan } = input;
  const totalHeight = rowHeight * count;
  if (count === 0 || rowHeight <= 0) {
    return { start: 0, end: 0, offsetTop: 0, totalHeight: Math.max(0, totalHeight) };
  }
  const firstVisible = Math.floor(scrollTop / rowHeight);
  const lastVisible = Math.floor((scrollTop + viewportHeight) / rowHeight);
  const start = Math.min(count, Math.max(0, firstVisible - overscan));
  const end = Math.min(count, Math.max(start, lastVisible + overscan + 1));
  return { start, end, offsetTop: start * rowHeight, totalHeight };
}
