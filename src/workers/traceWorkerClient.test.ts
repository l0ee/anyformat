import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TraceWorkerResult, TraceWorkerTask, TraceResult } from '../engine/types';
import { TraceWorkerClient } from './traceWorkerClient';

type WorkerStub = {
  postMessage: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
  onmessage: ((event: MessageEvent<TraceWorkerResult>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
};

type WorkerItemStub = {
  worker: Worker;
  busy: boolean;
  activeRequestId: string | null;
};

type ClientInternals = {
  workers: WorkerItemStub[];
  isWorkerSupported: boolean;
  pendingRequests: Map<string, unknown>;
  pendingQueue: string[];
  decodingRequests: Set<AbortController>;
  handleWorkerMessage: (item: WorkerItemStub, event: MessageEvent<TraceWorkerResult>) => void;
  handleWorkerError: (item: WorkerItemStub, event: ErrorEvent) => void;
  handleWorkerMessageError: (item: WorkerItemStub) => void;
};

class PendingImageStub {
  width = 4000;
  height = 2000;
  src = '';
  onload: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  removeAttribute = vi.fn((attribute: string) => {
    if (attribute === 'src') this.src = '';
  });
}

function createImageData(width = 10, height = 10): ImageData {
  return {
    data: new Uint8ClampedArray(width * height * 4),
    width,
    height
  } as ImageData;
}

function createWorker(): WorkerStub {
  return {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    onmessage: null,
    onerror: null,
    onmessageerror: null
  };
}

function installReplacementWorkerMock(replacements: WorkerStub[]) {
  const WorkerConstructor = vi.fn(function FakeWorker() {
    const replacement = createWorker();
    replacements.push(replacement);
    return replacement;
  });
  vi.stubGlobal('window', {});
  vi.stubGlobal('Worker', WorkerConstructor);
  return WorkerConstructor;
}

function createResult(width = 10, height = 10): TraceResult {
  return {
    svg: `<svg width="${width}" height="${height}"/>`,
    width,
    height,
    pathCount: 0,
    nodeCount: 0
  };
}

function configureWorkers(client: TraceWorkerClient, workerStubs: WorkerStub[]): WorkerStub[] {
  const internals = client as unknown as ClientInternals;
  const items = workerStubs.map(worker => ({
    worker: worker as unknown as Worker,
    busy: false,
    activeRequestId: null
  }));

  internals.workers = items;
  internals.isWorkerSupported = true;

  for (const item of items) {
    const worker = item.worker as unknown as WorkerStub;
    worker.onmessage = event => internals.handleWorkerMessage(item, event);
    worker.onerror = event => internals.handleWorkerError(item, event);
    worker.onmessageerror = () => internals.handleWorkerMessageError(item);
  }

  return workerStubs;
}

function sendResult(worker: WorkerStub, response: TraceWorkerResult): void {
  worker.onmessage?.({ data: response } as MessageEvent<TraceWorkerResult>);
}

function firstTask(worker: WorkerStub): TraceWorkerTask {
  return worker.postMessage.mock.calls[0][0] as TraceWorkerTask;
}

describe('TraceWorkerClient', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('transfers a private ImageData clone and keeps caller data safe on post failure', async () => {
    const client = new TraceWorkerClient();
    const worker = createWorker();
    worker.postMessage.mockImplementation(() => {
      throw new Error('Worker communication failure');
    });
    configureWorkers(client, [worker]);

    const imageData = createImageData();
    const originalBytes = Array.from(imageData.data);
    const result = await client.traceMonochrome(imageData);

    const task = firstTask(worker);
    const transferList = worker.postMessage.mock.calls[0][1] as Transferable[];
    expect(task.imageData.data.buffer).not.toBe(imageData.data.buffer);
    expect(transferList[0]).toBe(task.imageData.data.buffer);
    expect(Array.from(imageData.data)).toEqual(originalBytes);
    expect(result.width).toBe(imageData.width);
    expect(result.height).toBe(imageData.height);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('dispatches queued tasks FIFO across idle workers', async () => {
    const client = new TraceWorkerClient();
    const workers = configureWorkers(client, [createWorker(), createWorker()]);
    const imageData = createImageData();

    const first = client.traceMonochrome(imageData);
    const second = client.traceMonochrome(imageData);
    const third = client.traceMonochrome(imageData);

    expect(workers[0].postMessage).toHaveBeenCalledOnce();
    expect(workers[1].postMessage).toHaveBeenCalledOnce();
    expect(workers[0].postMessage).toHaveBeenCalledTimes(1);
    expect(workers[1].postMessage).toHaveBeenCalledTimes(1);

    const firstTask = firstTaskFor(workers[0]);
    const secondTask = firstTaskFor(workers[1]);
    sendResult(workers[0], { id: firstTask.id, status: 'success', result: createResult() });

    expect(workers[0].postMessage).toHaveBeenCalledTimes(2);
    const thirdTask = workers[0].postMessage.mock.calls[1][0] as TraceWorkerTask;
    expect(thirdTask.id).not.toBe(firstTask.id);
    expect(thirdTask.id).not.toBe(secondTask.id);

    sendResult(workers[1], { id: secondTask.id, status: 'success', result: createResult() });
    sendResult(workers[0], { id: thirdTask.id, status: 'success', result: createResult() });

    await expect(Promise.all([first, second, third])).resolves.toHaveLength(3);
  });

  it('rejects a timed-out task and replaces its worker for later queued work', async () => {
    vi.useFakeTimers();
    const client = new TraceWorkerClient();
    const worker = createWorker();
    configureWorkers(client, [worker]);

    const active = client.traceMonochrome(createImageData());
    const queued = client.traceMonochrome(createImageData());
    const later = client.traceMonochrome(createImageData());
    const timeoutResult = expect(queued).rejects.toThrow(
      /timed out.*retry.*lower resolution.*smaller image/i
    );

    expect(worker.postMessage).toHaveBeenCalledOnce();
    const activeTask = firstTaskFor(worker);

    // The queued task does not consume timeout budget while waiting.
    await vi.advanceTimersByTimeAsync(9_999);
    expect(worker.terminate).not.toHaveBeenCalled();

    sendResult(worker, { id: activeTask.id, status: 'success', result: createResult() });
    await expect(active).resolves.toBeDefined();
    expect(worker.postMessage).toHaveBeenCalledTimes(2);

    const replacementWorkers: WorkerStub[] = [];
    const WorkerConstructor = installReplacementWorkerMock(replacementWorkers);

    // The queued task remains active for a full 9,999ms after dispatch.
    await vi.advanceTimersByTimeAsync(9_999);
    expect(worker.terminate).not.toHaveBeenCalled();

    // Its own 10,000ms execution timeout now rejects instead of repeating the
    // same expensive trace on the main thread.
    await vi.advanceTimersByTimeAsync(1);
    await timeoutResult;
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(WorkerConstructor).toHaveBeenCalledOnce();
    expect(replacementWorkers).toHaveLength(1);
    expect(replacementWorkers[0].postMessage).toHaveBeenCalledOnce();

    const laterTask = firstTaskFor(replacementWorkers[0]);
    sendResult(replacementWorkers[0], {
      id: laterTask.id,
      status: 'success',
      result: createResult()
    });
    await expect(later).resolves.toBeDefined();

    const internals = client as unknown as ClientInternals;
    expect(internals.pendingRequests.size).toBe(0);
    expect(internals.pendingQueue).toHaveLength(0);
  });

  it('cancels queued work without fallback and continues dispatching remaining requests', async () => {
    const client = new TraceWorkerClient();
    const worker = createWorker();
    configureWorkers(client, [worker]);
    const imageData = createImageData();
    const controller = new AbortController();

    const active = client.traceMonochrome(imageData);
    const cancelled = client.traceMonochrome(imageData, undefined, controller.signal);
    const remaining = client.traceMonochrome(imageData);
    const cancellation = expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
    const removeAbortListener = vi.spyOn(controller.signal, 'removeEventListener');

    controller.abort();
    await cancellation;

    expect(removeAbortListener).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(worker.postMessage).toHaveBeenCalledOnce();
    const internals = client as unknown as ClientInternals;
    expect(internals.pendingQueue).toHaveLength(1);

    const activeTask = firstTaskFor(worker);
    sendResult(worker, { id: activeTask.id, status: 'success', result: createResult() });
    expect(worker.postMessage).toHaveBeenCalledTimes(2);
    const remainingTask = worker.postMessage.mock.calls[1][0] as TraceWorkerTask;
    sendResult(worker, { id: remainingTask.id, status: 'success', result: createResult() });

    await expect(Promise.all([active, remaining])).resolves.toHaveLength(2);
    expect(internals.pendingRequests.size).toBe(0);
    expect(internals.pendingQueue).toHaveLength(0);
  });

  it('retires an actively canceled worker and dispatches queued work on its replacement', async () => {
    vi.useFakeTimers();
    const client = new TraceWorkerClient();
    const worker = createWorker();
    configureWorkers(client, [worker]);
    const controller = new AbortController();
    const active = client.traceMonochrome(createImageData(), undefined, controller.signal);
    const remaining = client.traceMonochrome(createImageData());
    expect(vi.getTimerCount()).toBe(1);
    const cancellation = expect(active).rejects.toMatchObject({ name: 'AbortError' });
    const removeAbortListener = vi.spyOn(controller.signal, 'removeEventListener');
    const replacementWorkers: WorkerStub[] = [];
    const WorkerConstructor = installReplacementWorkerMock(replacementWorkers);

    controller.abort();
    await cancellation;

    expect(removeAbortListener).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(worker.onmessage).toBeNull();
    expect(WorkerConstructor).toHaveBeenCalledOnce();
    expect(replacementWorkers).toHaveLength(1);
    expect(replacementWorkers[0].postMessage).toHaveBeenCalledOnce();
    // The canceled timer is gone; the one remaining timer belongs to the
    // request that was dispatched on the replacement worker.
    expect(vi.getTimerCount()).toBe(1);

    const remainingTask = firstTaskFor(replacementWorkers[0]);
    sendResult(replacementWorkers[0], {
      id: remainingTask.id,
      status: 'success',
      result: createResult()
    });
    await expect(remaining).resolves.toBeDefined();
    expect(vi.getTimerCount()).toBe(0);

    const internals = client as unknown as ClientInternals;
    expect(internals.pendingRequests.size).toBe(0);
    expect(internals.pendingQueue).toHaveLength(0);
  });

  it('aborts File image decoding and releases its URL and listeners on terminate', async () => {
    const client = new TraceWorkerClient();
    const image = new PendingImageStub();
    vi.stubGlobal('Image', class {
      constructor() {
        return image;
      }
    });
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pending-image');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    const request = client.traceMonochrome(new File(['image'], 'pending.png', { type: 'image/png' }));
    const internals = client as unknown as ClientInternals;
    const controller = Array.from(internals.decodingRequests)[0];
    expect(controller).toBeDefined();
    expect(internals.pendingRequests.size).toBe(0);
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(image.src).toBe('blob:pending-image');
    const removeAbortListener = vi.spyOn(controller.signal, 'removeEventListener');
    const rejection = expect(request).rejects.toThrow('Trace worker client was terminated.');

    client.terminate();
    await rejection;

    expect(controller.signal.aborted).toBe(true);
    expect(removeAbortListener).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:pending-image');
    expect(image.removeAttribute).toHaveBeenCalledExactlyOnceWith('src');
    expect(image.src).toBe('');
    expect(image.onload).toBeNull();
    expect(image.onerror).toBeNull();
    expect(internals.decodingRequests.size).toBe(0);
  });

  it('aborts File image decoding from the caller signal and releases decode resources', async () => {
    const client = new TraceWorkerClient();
    const image = new PendingImageStub();
    vi.stubGlobal('Image', class {
      constructor() {
        return image;
      }
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:caller-abort-image');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const controller = new AbortController();
    const request = client.traceColor(
      new File(['image'], 'pending.png', { type: 'image/png' }),
      undefined,
      controller.signal
    );
    const internals = client as unknown as ClientInternals;
    const decodeController = Array.from(internals.decodingRequests)[0];
    const removeCallerAbortListener = vi.spyOn(controller.signal, 'removeEventListener');
    const removeDecodeAbortListener = vi.spyOn(decodeController.signal, 'removeEventListener');
    const cancellation = expect(request).rejects.toMatchObject({ name: 'AbortError' });

    controller.abort();
    await cancellation;

    expect(decodeController.signal.aborted).toBe(true);
    expect(removeCallerAbortListener).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(removeDecodeAbortListener).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:caller-abort-image');
    expect(image.removeAttribute).toHaveBeenCalledExactlyOnceWith('src');
    expect(image.onload).toBeNull();
    expect(image.onerror).toBeNull();
    expect(internals.decodingRequests.size).toBe(0);
  });

  it('falls back queued work when a worker raises an unhandled error', async () => {
    const client = new TraceWorkerClient();
    const worker = createWorker();
    configureWorkers(client, [worker]);

    const active = client.traceMonochrome(createImageData());
    const queued = client.traceMonochrome(createImageData());
    worker.onerror?.({ message: 'worker crashed' } as ErrorEvent);

    await expect(active).resolves.toBeDefined();
    await expect(queued).resolves.toBeDefined();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('reuses a worker after a task-level error response', async () => {
    const client = new TraceWorkerClient();
    const worker = createWorker();
    configureWorkers(client, [worker]);

    const failedTaskPromise = client.traceMonochrome(createImageData());
    const nextTaskPromise = client.traceMonochrome(createImageData());
    const failedTask = firstTask(worker);

    sendResult(worker, {
      id: failedTask.id,
      status: 'error',
      error: 'trace failed'
    });

    expect(worker.postMessage).toHaveBeenCalledTimes(2);
    const nextTask = worker.postMessage.mock.calls[1][0] as TraceWorkerTask;
    sendResult(worker, { id: nextTask.id, status: 'success', result: createResult() });

    await expect(failedTaskPromise).resolves.toBeDefined();
    await expect(nextTaskPromise).resolves.toBeDefined();
    expect(worker.terminate).not.toHaveBeenCalled();
  });

  it('does not let an unexpected response resolve another request', async () => {
    const client = new TraceWorkerClient();
    const worker = createWorker();
    configureWorkers(client, [worker]);

    const request = client.traceMonochrome(createImageData());
    sendResult(worker, { id: 'stale-request', status: 'success', result: createResult() });

    await expect(request).resolves.toBeDefined();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('rejects active and queued requests when terminated', async () => {
    const client = new TraceWorkerClient();
    const worker = createWorker();
    configureWorkers(client, [worker]);

    const active = client.traceMonochrome(createImageData());
    const queued = client.traceMonochrome(createImageData());
    client.terminate();

    await expect(active).rejects.toThrow('terminated');
    await expect(queued).rejects.toThrow('terminated');
    expect(worker.terminate).toHaveBeenCalledOnce();

    const internals = client as unknown as ClientInternals;
    expect(internals.pendingRequests.size).toBe(0);
    expect(internals.pendingQueue).toHaveLength(0);
  });

  it('removes dead worker from pool and disables workers when replacement fails', async () => {
    const client = new TraceWorkerClient();
    const worker = createWorker();
    configureWorkers(client, [worker]);
    const internals = client as unknown as ClientInternals;

    vi.stubGlobal('Worker', vi.fn(() => {
      throw new Error('Worker creation failed');
    }));

    const taskPromise = client.traceMonochrome(createImageData());
    worker.onerror?.({ message: 'Crash' } as ErrorEvent);

    await expect(taskPromise).resolves.toBeDefined();
    expect(internals.workers).toHaveLength(0);
    expect(internals.isWorkerSupported).toBe(false);
  });

  it('rejects decompression bomb images whose dimensions exceed safe limits', async () => {
    vi.stubGlobal('Image', class {
      src = '';
      onload = null;
      onerror = null;
      removeAttribute = vi.fn();
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:bomb');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    const client = new TraceWorkerClient();
    const buffer = new Uint8Array(32);
    const view = new DataView(buffer.buffer);
    view.setUint32(0, 0x89504e47);
    view.setUint32(4, 0x0d0a1a0a);
    view.setUint32(8, 13);
    view.setUint32(12, 0x49484452);
    view.setUint32(16, 20000);
    view.setUint32(20, 20000);

    const file = new File([buffer], 'bomb.png', { type: 'image/png' });
    await expect(client.traceMonochrome(file)).rejects.toThrow(/exceed maximum allowable size/);
  });

  it('falls back directly when workers are unavailable', async () => {
    const client = new TraceWorkerClient();
    const internals = client as unknown as ClientInternals;
    internals.isWorkerSupported = false;

    const result = await client.traceMonochrome(createImageData(20, 20), { maxResolution: 10 });

    expect(result.width).toBe(20);
    expect(result.height).toBe(20);
    expect(result.svg).toContain('width="20" height="20"');
  });

  it('preserves original unscaled image dimensions when downsampling a File', async () => {
    const client = new TraceWorkerClient();
    const worker = createWorker();
    configureWorkers(client, [worker]);

    const fakeImage = {
      naturalWidth: 200,
      naturalHeight: 100,
      width: 200,
      height: 100,
      src: '',
      onload: null as (() => void) | null,
      onerror: null,
      removeAttribute: vi.fn()
    };

    vi.stubGlobal('Image', class {
      constructor() {
        setTimeout(() => fakeImage.onload?.(), 0);
        return fakeImage;
      }
    });

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    const mockCtx = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => createImageData(100, 50))
    };
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => mockCtx)
    };
    vi.stubGlobal('document', {
      createElement: vi.fn((tag: string) => {
        if (tag === 'canvas') return mockCanvas;
        return {};
      })
    });

    const file = new File(['mock'], 'test.png', { type: 'image/png' });
    client.traceMonochrome(file, { maxResolution: 100 });

    await vi.waitFor(() => {
      expect(worker.postMessage).toHaveBeenCalled();
    });

    const task = firstTaskFor(worker);
    expect(task.origWidth).toBe(200);
    expect(task.origHeight).toBe(100);
    expect(task.imageData.width).toBe(100);
    expect(task.imageData.height).toBe(50);
  });
});

function firstTaskFor(worker: WorkerStub): TraceWorkerTask {
  return worker.postMessage.mock.calls[0][0] as TraceWorkerTask;
}
