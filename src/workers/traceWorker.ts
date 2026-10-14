import { traceMonochromeFromImageData } from '../engine/monochromeTracer';
import { traceColorFromImageData } from '../engine/colorTracer';
import { restoreTraceDimensions } from './traceWorkerUtils';
import { TraceWorkerTask, TraceWorkerResult, TraceResult, MonochromeOptions, ColorTracerOptions } from '../engine/types';

const ctx: Worker = self as unknown as Worker;

ctx.onmessage = (e: MessageEvent<TraceWorkerTask>) => {
  const task = e.data;
  const { id, type, imageData, options, origWidth, origHeight } = task;

  try {
    let result: TraceResult;

    if (type === 'monochrome') {
      result = traceMonochromeFromImageData(imageData, options as MonochromeOptions);
      if (origWidth && origHeight && (origWidth !== result.width || origHeight !== result.height)) {
        result = restoreTraceDimensions(result, origWidth, origHeight);
      }
    } else {
      result = traceColorFromImageData(imageData, options as ColorTracerOptions, origWidth, origHeight);
    }

    const response: TraceWorkerResult = {
      id,
      status: 'success',
      result
    };

    ctx.postMessage(response);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const response: TraceWorkerResult = {
      id,
      status: 'error',
      error: errorMessage
    };
    ctx.postMessage(response);
  }
};
