type Job = () => void;

type PhaseName = 'derivations' | 'effects' | 'renders';

const queues: Record<PhaseName, Set<Job>> = {
  derivations: new Set<Job>(),
  effects: new Set<Job>(),
  renders: new Set<Job>(),
};

const frameEndCbs = new Set<Job>();
const framePromises: Array<() => void> = [];
let scheduled = false;
let deprecationWarned = false;

const raf: (cb: () => void) => void =
  typeof requestAnimationFrame === 'function'
    ? (cb) => requestAnimationFrame(cb)
    : (cb) => queueMicrotask(cb);

function armFlush(): void {
  if (scheduled) return;
  scheduled = true;
  raf(flushSync);
}

export function scheduleDerivation(job: Job): void {
  queues.derivations.add(job);
  armFlush();
}

export function scheduleEffect(job: Job): void {
  queues.effects.add(job);
  armFlush();
}

export function scheduleRender(job: Job): void {
  queues.renders.add(job);
  armFlush();
}

export function onFrameEnd(job: Job): () => void {
  frameEndCbs.add(job);
  armFlush();
  return () => frameEndCbs.delete(job);
}

export function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    framePromises.push(resolve);
    armFlush();
  });
}

function drainQueue(name: PhaseName): boolean {
  const q = queues[name];
  if (q.size === 0) return false;
  const jobs = [...q];
  q.clear();
  for (const job of jobs) job();
  return true;
}

export function flushSync(): void {
  scheduled = false;
  let turns = 0;
  const MAX_TURNS = 20;
  while (turns < MAX_TURNS) {
    const dder = drainQueue('derivations');
    const deff = drainQueue('effects');
    const dren = drainQueue('renders');
    if (!dder && !deff && !dren) break;
    turns++;
  }
  if (turns >= MAX_TURNS) {
    // eslint-disable-next-line no-console
    console.warn('[uidetox] scheduler exceeded MAX_TURNS; possible infinite reactive loop');
  }
  const endJobs = [...frameEndCbs];
  frameEndCbs.clear();
  for (const job of endJobs) job();
  const promises = framePromises.splice(0, framePromises.length);
  for (const resolve of promises) resolve();
}

/**
 * @deprecated Use `scheduleEffect` instead.
 */
export function scheduleFlush(job: Job): void {
  if (!deprecationWarned) {
    deprecationWarned = true;
    // eslint-disable-next-line no-console
    console.warn('[uidetox] scheduleFlush is deprecated, use scheduleEffect. It will be removed in a future release.');
  }
  scheduleEffect(job);
}
