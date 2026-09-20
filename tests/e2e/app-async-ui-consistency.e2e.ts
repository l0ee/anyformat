import { expect, test } from '@playwright/test';

type TraceProbe = Window & {
  __traceTasks: Array<{ id: string; type: string }>;
  __releaseFirstTrace?: () => void;
  __fireNextDebounce?: () => void;
  __pendingDebounceCount?: () => number;
};

const validSvg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#e11d48"/></svg>',
);

test('does not publish an old trace released during the settings debounce window', async ({ page }) => {
  await page.addInitScript(() => {
    const probe = window as TraceProbe;
    probe.__traceTasks = [];
    const originalSetTimeout = window.setTimeout.bind(window);
    const originalClearTimeout = window.clearTimeout.bind(window);
    const heldDebounces = new Map<number, () => void>();
    let nextHeldId = 1_000_000;

    window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      if (timeout === 350 && typeof handler === 'function') {
        const id = nextHeldId++;
        heldDebounces.set(id, () => handler(...args));
        return id;
      }
      return originalSetTimeout(handler, timeout, ...args);
    }) as typeof window.setTimeout;

    window.clearTimeout = ((id?: number) => {
      if (id !== undefined && heldDebounces.delete(id)) return;
      originalClearTimeout(id);
    }) as typeof window.clearTimeout;

    probe.__fireNextDebounce = () => {
      const next = heldDebounces.entries().next().value as [number, () => void] | undefined;
      if (!next) throw new Error('No debounced trace is waiting');
      heldDebounces.delete(next[0]);
      next[1]();
    };
    probe.__pendingDebounceCount = () => heldDebounces.size;

    class ControlledWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      onmessageerror: ((event: MessageEvent) => void) | null = null;

      postMessage(task: { id: string; type: string }) {
        const taskIndex = probe.__traceTasks.push({ id: task.id, type: task.type }) - 1;
        const fill = taskIndex === 0 ? '#ff0000' : '#00ff00';
        const deliver = () => {
          this.onmessage?.({
            data: {
              id: task.id,
              status: 'success',
              result: {
                svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" width="1" height="1"><path d="M0 0" fill="${fill}"/></svg>`,
                width: 1,
                height: 1,
                pathCount: 1,
                nodeCount: 1,
                colors: [],
              },
            },
          } as MessageEvent);
        };

        if (taskIndex === 0) {
          probe.__releaseFirstTrace = deliver;
        } else {
          window.setTimeout(deliver, 0);
        }
      }

      terminate() {}
    }

    Object.defineProperty(window, 'Worker', {
      configurable: true,
      writable: true,
      value: ControlledWorker,
    });
  });

  await page.goto('/');
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable');
    context.fillStyle = '#333333';
    context.fillRect(0, 0, 2, 2);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('input[type="file"]').setInputFiles({
    name: 'trace-race.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  });

  await page.waitForFunction(() => (window as TraceProbe).__pendingDebounceCount?.() === 1);
  await page.evaluate(() => (window as TraceProbe).__fireNextDebounce?.());
  await page.waitForFunction(() => (window as TraceProbe).__traceTasks.length === 1);
  await expect(page.getByRole('status').filter({ hasText: 'Tracing curves & quantizing colors...' })).toBeVisible();

  await page.getByRole('button', { name: 'Black & White' }).click();
  await expect.poll(() => page.evaluate(() => (window as TraceProbe).__pendingDebounceCount?.())).toBe(1);
  await page.evaluate(() => {
    const release = (window as TraceProbe).__releaseFirstTrace;
    if (!release) throw new Error('First trace is not waiting');
    release();
  });

  // Let the old response and React commit settle, while remaining inside the
  // 350ms replacement debounce. No stale SVG should be published yet.
  await page.waitForTimeout(25);
  await expect(page.getByLabel('Optimized SVG source code')).toHaveText('', { timeout: 250 });
  await expect(page.getByRole('status').filter({ hasText: 'Tracing curves & quantizing colors...' })).toBeVisible();
  await page.waitForFunction(() => (window as TraceProbe).__traceTasks.length === 1);

  await page.evaluate(() => (window as TraceProbe).__fireNextDebounce?.());
  await page.waitForFunction(() => (window as TraceProbe).__traceTasks.length === 2);
  await expect(page.getByLabel('Optimized SVG source code')).toContainText('#0f0');
  expect(await page.evaluate(() => (window as TraceProbe).__traceTasks.map((task) => task.type))).toEqual([
    'color',
    'monochrome',
  ]);
});

test('an older timer does not dismiss a newer toast with the same message', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Format Converter' }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'toast-target.svg',
    mimeType: 'image/svg+xml',
    buffer: validSvg,
  });

  const targetSelect = page.getByLabel('Convert all to');
  const repeatedMessage = 'Set all target formats to .PNG';
  await targetSelect.selectOption('png');
  await expect(page.locator('.app-toast')).toContainText(repeatedMessage);

  await page.clock.runFor(2000);
  await targetSelect.selectOption('jpg');
  await targetSelect.selectOption('png');
  await expect(page.locator('.app-toast')).toContainText(repeatedMessage);

  await page.clock.runFor(1001);
  await expect(page.locator('.app-toast')).toContainText(repeatedMessage);
  await page.clock.runFor(2000);
  await expect(page.locator('.app-toast')).toHaveCount(0);
});

test('retrying failed files leaves idle files queued', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Format Converter' }).click();
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: 'failed.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('not a PDF document'),
  });
  await expect(page.getByRole('alert')).toContainText('Failed:', { timeout: 60_000 });

  await fileInput.setInputFiles({
    name: 'idle.svg',
    mimeType: 'image/svg+xml',
    buffer: validSvg,
  });
  await expect(page.getByText('Retry processes only failed files; 1 idle file remains queued.')).toBeVisible();
  await expect(page.getByText('0 completed, 1 failed of 2')).toBeVisible();

  const retryButton = page.getByRole('button', { name: 'Retry failed files' });
  await retryButton.click();
  await expect(retryButton).toBeEnabled({ timeout: 60_000 });
  await expect(page.getByText('0 completed, 1 failed of 2')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download idle.png' })).toHaveCount(0);
  await expect(page.getByRole('progressbar', { name: 'Converting idle.svg' })).toHaveCount(0);
});
