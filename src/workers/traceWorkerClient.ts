import {
  MonochromeOptions,
  ColorTracerOptions,
  TraceResult,
  TraceWorkerTask,
  TraceWorkerResult
} from '../engine/types';
import { loadImageData, traceMonochromeFromImageData } from '../engine/monochromeTracer';
import { traceColorFromImageData } from '../engine/colorTracer';

type PendingRequest = {
  resolve: (result: TraceResult) => void;
  reject: (error: Error) => void;
};

export class TraceWorkerClient {
  private worker: Worker | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private requestCounter: number = 0;
  private isWorkerSupported: boolean = false;

  constructor() {
    this.initWorker();
  }

  private initWorker(): void {
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('./traceWorker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = this.handleWorkerMessage.bind(this);
        this.worker.onerror = this.handleWorkerError.bind(this);
        this.isWorkerSupported = true;
      } catch (e) {
        console.warn('Failed to initialize Web Worker, falling back to main thread execution.', e);
        this.worker = null;
        this.isWorkerSupported = false;
      }
    }
  }

  private handleWorkerMessage(e: MessageEvent<TraceWorkerResult>): void {
    const { id, status, result, error } = e.data;
    const pending = this.pendingRequests.get(id);
    if (!pending) return;

    this.pendingRequests.delete(id);
    if (status === 'success' && result) {
      pending.resolve(result);
    } else {
      pending.reject(new Error(error || 'Worker tracing failed'));
    }
  }

  private handleWorkerError(e: ErrorEvent): void {
    console.error('TraceWorker error:', e);
    const err = new Error(e.message || 'Worker encountered an unhandled error');
    for (const pending of this.pendingRequests.values()) {
      pending.reject(err);
    }
    this.pendingRequests.clear();
  }

  public async traceMonochrome(
    fileOrData: File | ImageData,
    options: MonochromeOptions = {}
  ): Promise<TraceResult> {
    let imageData: ImageData;
    let origWidth: number;
    let origHeight: number;

    const maxRes = options.maxResolution ?? 1024;

    try {
      if (fileOrData instanceof File) {
        const loaded = await loadImageData(fileOrData, maxRes);
        imageData = loaded.imageData;
        origWidth = loaded.origWidth;
        origHeight = loaded.origHeight;
      } else {
        imageData = fileOrData;
        origWidth = imageData.width;
        origHeight = imageData.height;
      }
    } catch (e) {
      console.error('Failed to load ImageData on main thread:', e);
      throw e;
    }

    const fallbackToMainThread = () => {
      const res = traceMonochromeFromImageData(imageData, options);
      if (origWidth !== res.width || origHeight !== res.height) {
        const svgWithOrigViewBox = res.svg
          .replace(`width="${res.width}" height="${res.height}"`, `width="${origWidth}" height="${origHeight}"`);
        return { ...res, width: origWidth, height: origHeight, svg: svgWithOrigViewBox };
      }
      return res;
    };

    if (!this.isWorkerSupported || !this.worker) {
      return fallbackToMainThread();
    }

    const id = `mono_${++this.requestCounter}_${Date.now()}`;
    const task: TraceWorkerTask = {
      id,
      type: 'monochrome',
      imageData,
      options,
      origWidth,
      origHeight
    };

    return new Promise<TraceResult>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          console.warn(`Worker task ${id} timed out. Falling back to main thread execution.`);
          try {
            resolve(fallbackToMainThread());
          } catch (err) {
            reject(err);
          }
        }
      }, 10000);

      this.pendingRequests.set(id, {
        resolve: (result) => {
          clearTimeout(timeoutId);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          console.warn(`Worker task ${id} failed (${error.message}). Falling back to main thread execution.`);
          try {
            resolve(fallbackToMainThread());
          } catch (fallbackErr) {
            reject(fallbackErr);
          }
        }
      });

      try {
        this.worker!.postMessage(task);
      } catch (postErr) {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(id);
        console.warn(`Failed to postMessage to worker for task ${id}. Falling back to main thread execution.`, postErr);
        try {
          resolve(fallbackToMainThread());
        } catch (fallbackErr) {
          reject(fallbackErr);
        }
      }
    });
  }

  public async traceColor(
    fileOrData: File | ImageData,
    options: ColorTracerOptions = {}
  ): Promise<TraceResult> {
    let imageData: ImageData;
    let origWidth: number;
    let origHeight: number;

    const maxRes = options.maxResolution ?? 1024;

    try {
      if (fileOrData instanceof File) {
        const loaded = await loadImageData(fileOrData, maxRes);
        imageData = loaded.imageData;
        origWidth = loaded.origWidth;
        origHeight = loaded.origHeight;
      } else {
        imageData = fileOrData;
        origWidth = imageData.width;
        origHeight = imageData.height;
      }
    } catch (e) {
      console.error('Failed to load ImageData on main thread:', e);
      throw e;
    }

    const fallbackToMainThread = () => {
      return traceColorFromImageData(imageData, options, origWidth, origHeight);
    };

    if (!this.isWorkerSupported || !this.worker) {
      return fallbackToMainThread();
    }

    const id = `color_${++this.requestCounter}_${Date.now()}`;
    const task: TraceWorkerTask = {
      id,
      type: 'color',
      imageData,
      options,
      origWidth,
      origHeight
    };

    return new Promise<TraceResult>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          console.warn(`Worker task ${id} timed out. Falling back to main thread execution.`);
          try {
            resolve(fallbackToMainThread());
          } catch (err) {
            reject(err);
          }
        }
      }, 10000);

      this.pendingRequests.set(id, {
        resolve: (result) => {
          clearTimeout(timeoutId);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          console.warn(`Worker task ${id} failed (${error.message}). Falling back to main thread execution.`);
          try {
            resolve(fallbackToMainThread());
          } catch (fallbackErr) {
            reject(fallbackErr);
          }
        }
      });

      try {
        this.worker!.postMessage(task);
      } catch (postErr) {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(id);
        console.warn(`Failed to postMessage to worker for task ${id}. Falling back to main thread execution.`, postErr);
        try {
          resolve(fallbackToMainThread());
        } catch (fallbackErr) {
          reject(fallbackErr);
        }
      }
    });
  }

  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isWorkerSupported = false;
    }
    this.pendingRequests.clear();
  }
}

export const traceWorkerClient = new TraceWorkerClient();
