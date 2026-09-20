import {
  MonochromeOptions,
  ColorTracerOptions,
  TraceResult,
  TraceWorkerTask,
  TraceWorkerResult,
} from '../engine/types';
import { traceMonochromeFromImageData } from '../engine/monochromeTracer';
import { traceColorFromImageData } from '../engine/colorTracer';
import { restoreTraceDimensions } from './traceWorkerUtils';

export interface WorkerItem {
  worker: Worker;
  busy: boolean;
  activeRequestId: string | null;
}

interface PendingTask {
  id: string;
  task: TraceWorkerTask;
  resolve: (result: TraceResult) => void;
  reject: (error: Error) => void;
  signal?: AbortSignal;
  onCallerAbort?: () => void;
  timer?: ReturnType<typeof setTimeout> | null;
  workerItem?: WorkerItem | null;
  fallback: () => Promise<TraceResult>;
}

export class TraceWorkerClient {
  private workers: WorkerItem[] = [];
  private pendingRequests: Map<string, PendingTask> = new Map();
  private pendingQueue: string[] = [];
  private decodingRequests: Set<AbortController> = new Set();
  private requestCounter: number = 0;
  private isWorkerSupported: boolean = false;

  constructor() {
    this.initWorkers();
  }

  private initWorkers(): void {
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      try {
        const item = this.createWorkerItem();
        this.workers.push(item);
        this.isWorkerSupported = true;
      } catch (e) {
        console.warn('Failed to initialize Web Worker, falling back to main thread execution.', e);
        this.isWorkerSupported = false;
      }
    } else {
      this.isWorkerSupported = false;
    }
  }

  private createWorkerItem(): WorkerItem {
    const worker = new Worker(new URL('./traceWorker.ts', import.meta.url), { type: 'module' });
    const item: WorkerItem = { worker, busy: false, activeRequestId: null };
    worker.onmessage = (event) => this.handleWorkerMessage(item, event);
    worker.onerror = (event) => this.handleWorkerError(item, event);
    worker.onmessageerror = () => this.handleWorkerMessageError(item);
    return item;
  }

  private replaceWorker(oldItem: WorkerItem): WorkerItem {
    try {
      oldItem.worker.onmessage = null;
      oldItem.worker.onerror = null;
      oldItem.worker.onmessageerror = null;
      oldItem.worker.terminate();
    } catch {
      // Ignore termination errors
    }

    let newItem: WorkerItem;
    try {
      newItem = this.createWorkerItem();
    } catch {
      newItem = { worker: oldItem.worker, busy: false, activeRequestId: null };
    }

    const index = this.workers.indexOf(oldItem);
    if (index !== -1) {
      this.workers[index] = newItem;
    } else {
      this.workers.push(newItem);
    }

    return newItem;
  }

  public handleWorkerMessage(item: WorkerItem, event: MessageEvent<TraceWorkerResult>): void {
    const data = event?.data;
    if (!data || data.id !== item.activeRequestId) {
      // Unexpected or out-of-sync response: retire worker and fallback active task
      const activeId = item.activeRequestId;
      this.replaceWorker(item);

      if (activeId) {
        const activeReq = this.pendingRequests.get(activeId);
        if (activeReq) {
          this.cleanupRequest(activeReq);
          activeReq.fallback().then(activeReq.resolve, activeReq.reject);
        }
      }

      this.dispatchNext();
      return;
    }

    const req = this.pendingRequests.get(data.id);
    if (!req) return;

    this.cleanupRequest(req);

    if (data.status === 'success' && data.result) {
      item.busy = false;
      item.activeRequestId = null;
      req.resolve(data.result);
      this.dispatchNext();
    } else {
      // Task-level error response: reuse worker, fallback task to main thread
      item.busy = false;
      item.activeRequestId = null;
      req.fallback().then(req.resolve, req.reject);
      this.dispatchNext();
    }
  }

  public handleWorkerError(item: WorkerItem, event?: ErrorEvent): void {
    if (event) {
      console.error('TraceWorker error:', event.message || event);
    }
    const activeId = item.activeRequestId;
    this.replaceWorker(item);

    if (activeId) {
      const activeReq = this.pendingRequests.get(activeId);
      if (activeReq) {
        this.cleanupRequest(activeReq);
        activeReq.fallback().then(activeReq.resolve, activeReq.reject);
      }
    }

    // Fall back queued work
    while (this.pendingQueue.length > 0) {
      const queuedId = this.pendingQueue.shift()!;
      const queuedReq = this.pendingRequests.get(queuedId);
      if (queuedReq) {
        this.cleanupRequest(queuedReq);
        queuedReq.fallback().then(queuedReq.resolve, queuedReq.reject);
      }
    }

    this.dispatchNext();
  }

  public handleWorkerMessageError(item: WorkerItem): void {
    this.handleWorkerError(item, new ErrorEvent('messageerror', { message: 'Worker message error' }));
  }

  private cleanupRequest(req: PendingTask): void {
    if (req.timer) {
      clearTimeout(req.timer);
      req.timer = null;
    }
    if (req.signal && req.onCallerAbort) {
      req.signal.removeEventListener('abort', req.onCallerAbort);
      req.onCallerAbort = undefined;
    }
    this.pendingRequests.delete(req.id);
  }

  private dispatchNext(): void {
    if (this.pendingQueue.length === 0) return;

    const availableWorker = this.workers.find((w) => !w.busy);
    if (!availableWorker) return;

    const nextId = this.pendingQueue.shift()!;
    const req = this.pendingRequests.get(nextId);
    if (!req) {
      this.dispatchNext();
      return;
    }

    availableWorker.busy = true;
    availableWorker.activeRequestId = req.id;
    req.workerItem = availableWorker;

    // Start 10s execution timer when task is dispatched
    req.timer = setTimeout(() => {
      this.cleanupRequest(req);
      this.replaceWorker(availableWorker);
      req.reject(
        new Error('Tracing timed out. Please retry with a lower resolution or smaller image.')
      );
      this.dispatchNext();
    }, 10_000);

    try {
      availableWorker.worker.postMessage(req.task, [req.task.imageData.data.buffer]);
    } catch {
      // If postMessage throws, terminate worker and resolve via fallback
      this.cleanupRequest(req);
      this.replaceWorker(availableWorker);
      req.fallback().then(req.resolve, req.reject);
      this.dispatchNext();
    }
  }

  private createAbortError(message = 'The operation was aborted'): Error {
    const error = new Error(message);
    error.name = 'AbortError';
    return error;
  }

  private decodeFile(
    file: File,
    maxResolution?: number,
    signal?: AbortSignal
  ): Promise<ImageData> {
    return new Promise<ImageData>((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason || this.createAbortError());
        return;
      }

      const url = URL.createObjectURL(file);
      const img = new Image();

      const cleanup = () => {
        URL.revokeObjectURL(url);
        img.removeAttribute('src');
        img.src = '';
        img.onload = null;
        img.onerror = null;
        if (signal && onAbort) {
          signal.removeEventListener('abort', onAbort);
        }
      };

      const onAbort = () => {
        cleanup();
        reject(signal?.reason || this.createAbortError());
      };

      if (signal) {
        signal.addEventListener('abort', onAbort);
      }

      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;
          if (maxResolution && (width > maxResolution || height > maxResolution)) {
            if (width > height) {
              height = Math.round((height * maxResolution) / width);
              width = maxResolution;
            } else {
              width = Math.round((width * maxResolution) / height);
              height = maxResolution;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            cleanup();
            reject(new Error('Failed to get 2D context from canvas.'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const data = ctx.getImageData(0, 0, width, height);
          cleanup();
          resolve(data);
        } catch (err) {
          cleanup();
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      };

      img.onerror = () => {
        cleanup();
        reject(new Error('Failed to load image file for tracing.'));
      };

      img.src = url;
    });
  }

  public async traceMonochrome(
    fileOrData: File | ImageData,
    options: MonochromeOptions = {},
    signal?: AbortSignal
  ): Promise<TraceResult> {
    if (signal?.aborted) {
      throw signal.reason || this.createAbortError();
    }

    let imageData: ImageData;
    let origWidth: number;
    let origHeight: number;

    if (fileOrData instanceof File) {
      const decodeController = new AbortController();
      this.decodingRequests.add(decodeController);

      const onCallerAbort = () => {
        decodeController.abort(signal?.reason || this.createAbortError());
      };
      if (signal) {
        signal.addEventListener('abort', onCallerAbort);
      }

      try {
        imageData = await this.decodeFile(fileOrData, options.maxResolution, decodeController.signal);
      } finally {
        if (signal) {
          signal.removeEventListener('abort', onCallerAbort);
        }
        this.decodingRequests.delete(decodeController);
      }
      origWidth = imageData.width;
      origHeight = imageData.height;
    } else {
      imageData = fileOrData;
      origWidth = imageData.width;
      origHeight = imageData.height;
    }

    const fallback = async (): Promise<TraceResult> => {
      const res = traceMonochromeFromImageData(imageData, options);
      return restoreTraceDimensions(res, origWidth, origHeight);
    };

    if (!this.isWorkerSupported || this.workers.length === 0) {
      return fallback();
    }

    return new Promise<TraceResult>((resolve, reject) => {
      const id = `mono_${++this.requestCounter}_${Date.now()}`;
      const clonedBytes = new Uint8ClampedArray(imageData.data);
      const clonedImageData =
        typeof ImageData !== 'undefined'
          ? new ImageData(clonedBytes, imageData.width, imageData.height)
          : ({ data: clonedBytes, width: imageData.width, height: imageData.height } as ImageData);

      const task: TraceWorkerTask = {
        id,
        type: 'monochrome',
        imageData: clonedImageData,
        options,
        origWidth,
        origHeight,
      };

      const pendingTask: PendingTask = {
        id,
        task,
        resolve,
        reject,
        signal,
        fallback,
      };

      if (signal) {
        const onAbort = () => {
          const queueIndex = this.pendingQueue.indexOf(id);
          if (queueIndex !== -1) {
            // Task is still queued
            this.pendingQueue.splice(queueIndex, 1);
            this.cleanupRequest(pendingTask);
            reject(signal.reason || this.createAbortError());
          } else if (pendingTask.workerItem) {
            // Task is actively running on a worker
            const busyWorker = pendingTask.workerItem;
            this.cleanupRequest(pendingTask);
            this.replaceWorker(busyWorker);
            reject(signal.reason || this.createAbortError());
            this.dispatchNext();
          }
        };

        pendingTask.onCallerAbort = onAbort;
        signal.addEventListener('abort', onAbort);
      }

      this.pendingRequests.set(id, pendingTask);
      this.pendingQueue.push(id);
      this.dispatchNext();
    });
  }

  public async traceColor(
    fileOrData: File | ImageData,
    options: ColorTracerOptions = {},
    signal?: AbortSignal
  ): Promise<TraceResult> {
    if (signal?.aborted) {
      throw signal.reason || this.createAbortError();
    }

    let imageData: ImageData;
    let origWidth: number;
    let origHeight: number;

    if (fileOrData instanceof File) {
      const decodeController = new AbortController();
      this.decodingRequests.add(decodeController);

      const onCallerAbort = () => {
        decodeController.abort(signal?.reason || this.createAbortError());
      };
      if (signal) {
        signal.addEventListener('abort', onCallerAbort);
      }

      try {
        imageData = await this.decodeFile(fileOrData, options.maxResolution, decodeController.signal);
      } finally {
        if (signal) {
          signal.removeEventListener('abort', onCallerAbort);
        }
        this.decodingRequests.delete(decodeController);
      }
      origWidth = imageData.width;
      origHeight = imageData.height;
    } else {
      imageData = fileOrData;
      origWidth = imageData.width;
      origHeight = imageData.height;
    }

    const fallback = async (): Promise<TraceResult> => {
      const res = await traceColorFromImageData(imageData, options);
      return restoreTraceDimensions(res, origWidth, origHeight);
    };

    if (!this.isWorkerSupported || this.workers.length === 0) {
      return fallback();
    }

    return new Promise<TraceResult>((resolve, reject) => {
      const id = `color_${++this.requestCounter}_${Date.now()}`;
      const clonedBytes = new Uint8ClampedArray(imageData.data);
      const clonedImageData =
        typeof ImageData !== 'undefined'
          ? new ImageData(clonedBytes, imageData.width, imageData.height)
          : ({ data: clonedBytes, width: imageData.width, height: imageData.height } as ImageData);

      const task: TraceWorkerTask = {
        id,
        type: 'color',
        imageData: clonedImageData,
        options,
        origWidth,
        origHeight,
      };

      const pendingTask: PendingTask = {
        id,
        task,
        resolve,
        reject,
        signal,
        fallback,
      };

      if (signal) {
        const onAbort = () => {
          const queueIndex = this.pendingQueue.indexOf(id);
          if (queueIndex !== -1) {
            this.pendingQueue.splice(queueIndex, 1);
            this.cleanupRequest(pendingTask);
            reject(signal.reason || this.createAbortError());
          } else if (pendingTask.workerItem) {
            const busyWorker = pendingTask.workerItem;
            this.cleanupRequest(pendingTask);
            this.replaceWorker(busyWorker);
            reject(signal.reason || this.createAbortError());
            this.dispatchNext();
          }
        };

        pendingTask.onCallerAbort = onAbort;
        signal.addEventListener('abort', onAbort);
      }

      this.pendingRequests.set(id, pendingTask);
      this.pendingQueue.push(id);
      this.dispatchNext();
    });
  }

  public terminate(): void {
    // Abort all active file decoding requests
    for (const controller of this.decodingRequests) {
      controller.abort(new Error('Trace worker client was terminated.'));
    }
    this.decodingRequests.clear();

    // Reject all active and queued tasks
    const terminationError = new Error('Trace worker client was terminated.');
    for (const req of this.pendingRequests.values()) {
      if (req.timer) {
        clearTimeout(req.timer);
      }
      if (req.signal && req.onCallerAbort) {
        req.signal.removeEventListener('abort', req.onCallerAbort);
      }
      req.reject(terminationError);
    }

    this.pendingRequests.clear();
    this.pendingQueue = [];

    // Terminate all workers
    for (const item of this.workers) {
      try {
        item.worker.onmessage = null;
        item.worker.onerror = null;
        item.worker.onmessageerror = null;
        item.worker.terminate();
      } catch {
        // Ignore
      }
    }
    this.workers = [];
  }
}

export const traceWorkerClient = new TraceWorkerClient();
