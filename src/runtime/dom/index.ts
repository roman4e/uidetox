export {
  commitStage,
  mutate,
  mutateStructural,
  readStaged,
} from './stage.js';
export type { PropKind, StructuralOp } from './stage.js';
export { measure, measureOffscreen } from './measure.js';

import { commitStage } from './stage.js';
import { flushSync } from '../scheduler.js';

/** Commit staged DOM ops and drain the scheduler synchronously (test helper). */
export function commitSync(): void {
  commitStage();
  flushSync();
}
