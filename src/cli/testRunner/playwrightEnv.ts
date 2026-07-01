import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { RunResult } from '../../testing/run.js';

interface PlaywrightModule {
  chromium: {
    launch: (opts?: { headless?: boolean }) => Promise<PlaywrightBrowser>;
  };
}
interface PlaywrightBrowser {
  newContext: () => Promise<PlaywrightContext>;
  close: () => Promise<void>;
}
interface PlaywrightContext {
  newPage: () => Promise<PlaywrightPage>;
  close: () => Promise<void>;
}
interface PlaywrightPage {
  goto: (url: string) => Promise<unknown>;
  addScriptTag: (opts: { url?: string; content?: string }) => Promise<unknown>;
  evaluate: <T>(fn: string | (() => T)) => Promise<T>;
  screenshot: (opts?: { fullPage?: boolean }) => Promise<Buffer>;
}

async function loadPlaywright(): Promise<PlaywrightModule | null> {
  try {
    const dynImport = new Function('u', 'return import(u)') as (u: string) => Promise<unknown>;
    return (await dynImport('playwright')) as PlaywrightModule;
  } catch {
    return null;
  }
}

export async function runInPlaywright(
  cachePath: string,
  componentSnapshotDir: string,
  updateMode: boolean,
): Promise<RunResult> {
  if (process.env.PLAYWRIGHT_SKIP === '1') {
    return {
      outcomes: [
        {
          path: basename(cachePath),
          ok: false,
          durationMs: 0,
          error: 'PLAYWRIGHT_SKIP=1 was set; skipping browser tests',
        },
      ],
      passed: 0,
      failed: 1,
    };
  }
  const pw = await loadPlaywright();
  if (!pw) {
    return {
      outcomes: [
        {
          path: basename(cachePath),
          ok: false,
          durationMs: 0,
          error: 'playwright package could not be loaded. Run `pnpm playwright install chromium`.',
        },
      ],
      passed: 0,
      failed: 1,
    };
  }
  const browser = await pw.chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto('about:blank');
    await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.1/axe.min.js' });
    const moduleSource = await readFile(cachePath, 'utf8');
    void componentSnapshotDir; void updateMode;
    await page.addScriptTag({ content: `${moduleSource}\nwindow.__runTests = default_1;` });
    const raw = await page.evaluate<string>('JSON.stringify(await window.__runTests())');
    return JSON.parse(raw) as RunResult;
  } finally {
    await context.close();
    await browser.close();
  }
}
