import { AssertionError } from '../expect.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

export interface DiffResult {
  equal: boolean;
  diffPixels: number;
  diffPng: Buffer;
}

export function diffPngs(baselineBuf: Buffer, actualBuf: Buffer, threshold: number): DiffResult {
  const base = PNG.sync.read(baselineBuf);
  const act = PNG.sync.read(actualBuf);
  if (base.width !== act.width || base.height !== act.height) {
    return {
      equal: false,
      diffPixels: base.width * base.height + act.width * act.height,
      diffPng: actualBuf,
    };
  }
  const diff = new PNG({ width: base.width, height: base.height });
  const count = pixelmatch(base.data, act.data, diff.data, base.width, base.height, { threshold });
  return { equal: count === 0, diffPixels: count, diffPng: PNG.sync.write(diff) };
}

interface PixelConfig {
  componentDir: string;
  updateMode: boolean;
  takeScreenshot: (name: string) => Promise<Buffer>;
}

let config: PixelConfig | null = null;

export function configurePixelDriver(opts: PixelConfig): void {
  config = opts;
}

export async function pixel(name: string, opts?: { threshold?: number }): Promise<void> {
  if (!config) throw new AssertionError('pixel(): no driver configured; the runner sets one for the browser environment');
  const path = join(config.componentDir, `${name}.png`);
  const actual = await config.takeScreenshot(name);
  let baseline: Buffer | null = null;
  try {
    baseline = await fs.readFile(path);
  } catch {
    baseline = null;
  }
  if (!baseline) {
    if (!config.updateMode) {
      throw new AssertionError(`pixel(${name}): no baseline. Rerun with --update-snapshots to create ${path}.`);
    }
    await fs.mkdir(config.componentDir, { recursive: true });
    await fs.writeFile(path, actual);
    return;
  }
  const result = diffPngs(baseline, actual, opts?.threshold ?? 0.1);
  if (!result.equal) {
    if (config.updateMode) {
      await fs.writeFile(path, actual);
      return;
    }
    throw new AssertionError(`pixel(${name}): mismatch, ${result.diffPixels} pixels differ.`);
  }
}
