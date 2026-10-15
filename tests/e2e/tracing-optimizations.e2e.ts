import { expect, test, type Page } from '@playwright/test';

type OptimizationProbe = Window & {
  __traceTasks: Array<{ id: string; red: number }>;
  __activeTraces: number;
  __maxActiveTraces: number;
  __releaseTrace: (index: number) => void;
  __pendingCleanupCount: () => number;
  __releaseCleanup: () => void;
};

async function installControlledWorkers(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, value: 4 });
    const probe = window as OptimizationProbe;
    probe.__traceTasks = [];
    probe.__activeTraces = 0;
    probe.__maxActiveTraces = 0;
    const deliveries = new Map<number, () => void>();
    probe.__releaseTrace = (index) => {
      const deliver = deliveries.get(index);
      if (!deliver) throw new Error(`Trace ${index} is not waiting`);
      deliveries.delete(index);
      probe.__activeTraces--;
      deliver();
    };

    class ControlledWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      onmessageerror: ((event: MessageEvent) => void) | null = null;

      postMessage(task: { id: string; imageData: ImageData }) {
        const index = probe.__traceTasks.length;
        probe.__traceTasks.push({ id: task.id, red: task.imageData.data[0] });
        probe.__activeTraces++;
        probe.__maxActiveTraces = Math.max(probe.__maxActiveTraces, probe.__activeTraces);
        deliveries.set(index, () => this.onmessage?.({
          data: {
            id: task.id,
            status: 'success',
            result: {
              svg: '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><path d="M0.12345 0L1.98765 2" fill="#112233"/></svg>',
              width: 2, height: 2, pathCount: 1, nodeCount: 2, colors: [],
            },
          },
        } as MessageEvent));
      }

      terminate() {}
    }
    Object.defineProperty(window, 'Worker', { configurable: true, value: ControlledWorker });
  });
}

async function pngFiles(page: Page, count: number) {
  const encoded = await page.evaluate((count) => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const context = canvas.getContext('2d')!;
    return Array.from({ length: count }, (_, index) => {
      context.fillStyle = `rgb(${index + 1}, 0, 0)`;
      context.fillRect(0, 0, 2, 2);
      return canvas.toDataURL('image/png').split(',')[1];
    });
  }, count);
  return encoded.map((png, index) => ({
    name: `trace-${index + 1}.png`, mimeType: 'image/png', buffer: Buffer.from(png, 'base64'),
  }));
}

test('bounds parallel batch work, claims files once, and retries only failures', async ({ page }) => {
  await installControlledWorkers(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Create SVG', exact: true }).click();
  await page.getByRole('button', { name: 'Work with multiple images', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles([
    ...(await pngFiles(page, 4)),
    { name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not a PNG') },
  ]);
  const queue = page.getByRole('region', { name: 'Batch queue (5 files)' });
  await expect(queue).toBeVisible();
  await page.getByRole('button', { name: 'Process batch', exact: true }).click();
  await page.waitForFunction(() => (window as OptimizationProbe).__traceTasks.length === 2);
  await expect(queue.getByRole('status')).toContainText('3 ready · 2 processing');

  // Complete out of order while a workspace switch occurs mid-run.
  await page.getByRole('button', { name: 'Convert files', exact: true }).click();
  await page.evaluate(() => (window as OptimizationProbe).__releaseTrace(1));
  await page.waitForFunction(() => (window as OptimizationProbe).__traceTasks.length === 3);
  await page.evaluate(() => (window as OptimizationProbe).__releaseTrace(0));
  await page.waitForFunction(() => (window as OptimizationProbe).__traceTasks.length === 4);
  await page.evaluate(() => {
    (window as OptimizationProbe).__releaseTrace(3);
    (window as OptimizationProbe).__releaseTrace(2);
  });
  await page.getByRole('button', { name: 'Create SVG', exact: true }).click();
  await page.getByRole('button', { name: 'Work with multiple images', exact: true }).click();
  await expect(queue.getByRole('status')).toContainText('0 ready · 0 processing · 4 completed · 1 failed');
  await expect(page.locator('.app-toast')).toContainText('Batch finished with 1 failed file.');
  const traces = await page.evaluate(() => ({
    tasks: (window as OptimizationProbe).__traceTasks,
    max: (window as OptimizationProbe).__maxActiveTraces,
  }));
  expect(traces.max).toBe(2);
  expect(traces.tasks.map((task) => task.red).sort()).toEqual([1, 2, 3, 4]);
  expect(new Set(traces.tasks.map((task) => task.id)).size).toBe(4);

  const retry = page.getByRole('button', { name: 'Retry failed files', exact: true });
  await retry.click();
  await expect(retry).toBeEnabled();
  await expect(queue.getByRole('status')).toContainText('4 completed · 1 failed');
  expect(await page.evaluate(() => (window as OptimizationProbe).__traceTasks.length)).toBe(4);
});

test('coalesces cleanup changes and exports the latest precision without retracing', async ({ page }) => {
  await installControlledWorkers(page);
  await page.addInitScript(() => {
    const probe = window as OptimizationProbe;
    const originalSetTimeout = window.setTimeout.bind(window);
    const originalClearTimeout = window.clearTimeout.bind(window);
    const timers = new Map<number, () => void>();
    let nextId = 1_000_000;
    window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      if (timeout === 100 && typeof handler === 'function') {
        const id = nextId++;
        timers.set(id, () => handler(...args));
        return id;
      }
      return originalSetTimeout(handler, timeout, ...args);
    }) as typeof window.setTimeout;
    window.clearTimeout = ((id?: number) => {
      if (id !== undefined && timers.delete(id)) return;
      originalClearTimeout(id);
    }) as typeof window.clearTimeout;
    probe.__pendingCleanupCount = () => timers.size;
    probe.__releaseCleanup = () => {
      for (const [id, callback] of timers) {
        timers.delete(id);
        callback();
      }
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Create SVG', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles((await pngFiles(page, 1))[0]);
  await page.waitForFunction(() => (window as OptimizationProbe).__traceTasks.length === 1);
  await page.evaluate(() => (window as OptimizationProbe).__releaseTrace(0));
  await page.getByText('SVG code and cleanup settings', { exact: true }).click();
  const code = page.getByLabel('Optimized SVG source code');
  await expect(code).toContainText('M0.12 0L1.99 2');
  const precision = page.getByLabel('Decimal places:');
  await precision.selectOption('1');
  await precision.selectOption('3');
  const downloadButton = page.getByRole('button', { name: 'DOWNLOAD OPTIMIZED SVG', exact: true });
  await expect(downloadButton).toBeDisabled();
  await expect(page.getByRole('button', { name: 'COPY SVG', exact: true })).toBeDisabled();
  await expect.poll(() => page.evaluate(() => (window as OptimizationProbe).__pendingCleanupCount())).toBe(1);
  await page.evaluate(() => (window as OptimizationProbe).__releaseCleanup());
  await expect(code).toContainText('M0.123 0L1.988 2');
  await expect(downloadButton).toBeEnabled();
  const downloadPromise = page.waitForEvent('download');
  await downloadButton.click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString()).toContain('M0.123 0L1.988 2');
  expect(await page.evaluate(() => (window as OptimizationProbe).__traceTasks.length)).toBe(1);
});

test('stops both parallel traces, keeps completed downloads, and resumes only pending files', async ({ page }) => {
  await installControlledWorkers(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Create SVG', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(await pngFiles(page, 4));
  const queue = page.getByRole('region', { name: 'Batch queue (4 files)' });
  const status = queue.getByRole('status');
  await page.getByRole('button', { name: 'Process batch', exact: true }).click();
  await page.waitForFunction(() => (window as OptimizationProbe).__traceTasks.length === 2);
  const firstIndex = await page.evaluate(() => (window as OptimizationProbe).__traceTasks.findIndex((task) => task.red === 1));
  await page.evaluate((index) => (window as OptimizationProbe).__releaseTrace(index), firstIndex);
  await page.waitForFunction(() => (window as OptimizationProbe).__traceTasks.length === 3);
  await expect(status).toContainText('1 ready · 2 processing · 1 completed · 0 failed');
  const firstDownload = page.getByRole('button', { name: 'Download trace-1.svg', exact: true });
  await expect(firstDownload).toBeVisible();
  const zipDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export 1 as ZIP', exact: true }).click();
  expect((await zipDownload).suggestedFilename()).toBe('vectorized_batch.zip');

  await page.getByRole('button', { name: 'Stop processing', exact: true }).click();
  await expect(status).toContainText('3 ready · 0 processing · 1 completed · 0 failed');
  await page.evaluate((index) => {
    (window as OptimizationProbe).__releaseTrace(1 - index);
    (window as OptimizationProbe).__releaseTrace(2);
  }, firstIndex);
  await expect(status).toContainText('3 ready · 0 processing · 1 completed · 0 failed');
  expect(await page.evaluate(() => (window as OptimizationProbe).__traceTasks.length)).toBe(3);
  await expect(firstDownload).toBeVisible();

  await page.getByRole('button', { name: 'Process batch', exact: true }).click();
  await page.waitForFunction(() => (window as OptimizationProbe).__traceTasks.length === 5);
  await page.evaluate(() => {
    (window as OptimizationProbe).__releaseTrace(3);
    (window as OptimizationProbe).__releaseTrace(4);
  });
  await page.waitForFunction(() => (window as OptimizationProbe).__traceTasks.length === 6);
  await page.evaluate(() => (window as OptimizationProbe).__releaseTrace(5));
  await expect(status).toContainText('0 ready · 0 processing · 4 completed · 0 failed');
  await expect(queue.getByRole('button', { name: /^Download trace-/ })).toHaveCount(4);
  expect(await page.evaluate(() => (window as OptimizationProbe).__traceTasks.filter((task) => task.red === 1).length)).toBe(1);
});

test('reveals off-screen queue controls on keyboard focus and measures expanded previews', async ({ page }) => {
  await page.goto('/');
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8"/></svg>');
  await page.locator('input[type="file"]').setInputFiles(Array.from({ length: 30 }, (_, index) => ({
    name: `queue-${index + 1}.svg`, mimeType: 'image/svg+xml', buffer: svg,
  })));
  const queue = page.getByRole('region', { name: 'Format conversion queue (30)' });
  const list = queue.getByRole('list');
  const lastRow = list.getByRole('listitem').last();
  await expect(list.getByRole('listitem')).toHaveCount(30);
  expect(await lastRow.evaluate((row) => getComputedStyle(row).contentVisibility)).toBe('auto');

  await queue.getByRole('button', { name: 'Remove queue-29.svg from conversion queue', exact: true }).focus();
  await page.keyboard.press('Tab');
  const output = page.getByLabel('Output for queue-30.svg');
  await expect(output).toBeFocused();
  const withinScrollport = await output.evaluate((control) => {
    const list = control.closest('ul')!.getBoundingClientRect();
    const bounds = control.getBoundingClientRect();
    return bounds.top >= list.top && bounds.bottom <= list.bottom;
  });
  expect(withinScrollport).toBe(true);
  await page.keyboard.press('Tab');
  const preview = lastRow.getByRole('button', { name: 'Preview', exact: true });
  await expect(preview).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(lastRow.getByRole('img', { name: 'Source preview for queue-30.svg' })).toBeVisible();
  expect(await lastRow.evaluate((row) => getComputedStyle(row).contentVisibility)).toBe('visible');
  await page.keyboard.press('Enter');
  await expect(lastRow.getByRole('button', { name: 'Preview', exact: true })).toBeFocused();
});
