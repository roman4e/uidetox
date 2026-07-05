// Runs the colocated `ts test` block from Counter.md. The uidetoxEsbuild plugin
// (mode: 'test') compiles the component AND re-emits its test block as `__tests`.
import { describe } from 'vitest';
// @ts-expect-error virtual export injected by uidetox/vite in test mode
import { __tests } from './Counter.md';

describe('Counter.md', __tests);
