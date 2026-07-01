type Job = () => void;

const queue = new Set<Job>();
let scheduled = false;

const raf: (cb: () => void) => void =
  typeof requestAnimationFrame === 'function'
    ? (cb) => requestAnimationFrame(cb)
    : (cb) => queueMicrotask(cb);

export function scheduleFlush(job: Job): void {
  queue.add(job);
  if (!scheduled) {
    scheduled = true;
    raf(flushSync);
  }
}

export function flushSync(): void {
  scheduled = false;
  while (queue.size > 0) {
    const jobs = [...queue];
    queue.clear();
    for (const job of jobs) job();
  }
}
