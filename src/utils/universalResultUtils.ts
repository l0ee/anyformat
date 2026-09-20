import { UniversalTaskItem } from '../engine/universal/types';

export interface UniversalBatchMetrics {
  totalSourceBytes: number;
  totalResultBytes: number;
  netByteDifference: number;
  percentageReduction: number;
}

export function calculateUniversalBatchMetrics(items: UniversalTaskItem[]): UniversalBatchMetrics {
  const completed = items.filter((item) => item.status === 'completed');
  if (completed.length === 0) {
    return {
      totalSourceBytes: 0,
      totalResultBytes: 0,
      netByteDifference: 0,
      percentageReduction: 0,
    };
  }

  let totalSourceBytes = 0;
  let totalResultBytes = 0;

  for (const item of completed) {
    const sourceSize = item.file?.size ?? 0;
    const resultSize = item.resultSize ?? item.resultBlob?.size ?? 0;
    totalSourceBytes += sourceSize;
    totalResultBytes += resultSize;
  }

  const netByteDifference = totalResultBytes - totalSourceBytes;
  const percentageReduction = totalSourceBytes > 0
    ? Math.round(((totalSourceBytes - totalResultBytes) / totalSourceBytes) * 100)
    : 0;

  return {
    totalSourceBytes,
    totalResultBytes,
    netByteDifference,
    percentageReduction,
  };
}

export async function copyResultToClipboard(item: UniversalTaskItem): Promise<boolean> {
  if (!item.resultBlob || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return false;
  }

  try {
    if (item.targetExt === 'svg' || item.resultBlob.type === 'image/svg+xml') {
      const text = await item.resultBlob.text();
      await navigator.clipboard.writeText(text);
      return true;
    }

    return new Promise<boolean>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        if (typeof reader.result === 'string') {
          try {
            await navigator.clipboard.writeText(reader.result);
            resolve(true);
          } catch {
            resolve(false);
          }
        } else {
          resolve(false);
        }
      };
      reader.onerror = () => resolve(false);
      reader.readAsDataURL(item.resultBlob!);
    });
  } catch {
    return false;
  }
}
