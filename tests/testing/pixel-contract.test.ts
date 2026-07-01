import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { diffPngs } from '../../src/testing/snapshot/pixel.js';

function solidPng(w: number, h: number, r: number, g: number, b: number): Buffer {
  const png = new PNG({ width: w, height: h });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = b; png.data[i + 3] = 255;
  }
  return PNG.sync.write(png);
}

describe('diffPngs()', () => {
  it('reports 0 diff for identical images', () => {
    const a = solidPng(4, 4, 255, 0, 0);
    const b = solidPng(4, 4, 255, 0, 0);
    const result = diffPngs(a, b, 0.1);
    expect(result.equal).toBeTruthy();
    expect(result.diffPixels).toBe(0);
  });

  it('reports mismatch on different images', () => {
    const a = solidPng(4, 4, 255, 0, 0);
    const b = solidPng(4, 4, 0, 0, 255);
    const result = diffPngs(a, b, 0.1);
    expect(result.equal).toBeFalsy();
    expect(result.diffPixels).toBeGreaterThan(0);
  });
});
