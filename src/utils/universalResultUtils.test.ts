import { describe, expect, it, vi } from 'vitest';
import { UniversalTaskItem } from '../engine/universal/types';
import { calculateUniversalBatchMetrics, copyResultToClipboard } from './universalResultUtils';

describe('universalResultUtils', () => {
  describe('calculateUniversalBatchMetrics', () => {
    it('returns zeroes when no items are completed', () => {
      const items: UniversalTaskItem[] = [
        {
          id: '1',
          file: new File(['hello'], 'test.png', { type: 'image/png' }),
          name: 'test.png',
          sourceExt: 'png',
          targetExt: 'jpg',
          status: 'idle',
          progress: 0,
        },
      ];
      expect(calculateUniversalBatchMetrics(items)).toEqual({
        totalSourceBytes: 0,
        totalResultBytes: 0,
        netByteDifference: 0,
        percentageReduction: 0,
      });
    });

    it('correctly calculates metrics for completed items', () => {
      const items: UniversalTaskItem[] = [
        {
          id: '1',
          file: { size: 1000 } as File,
          name: 'a.png',
          sourceExt: 'png',
          targetExt: 'jpg',
          status: 'completed',
          progress: 100,
          resultSize: 400,
        },
        {
          id: '2',
          file: { size: 1000 } as File,
          name: 'b.png',
          sourceExt: 'png',
          targetExt: 'jpg',
          status: 'completed',
          progress: 100,
          resultSize: 600,
        },
      ];
      expect(calculateUniversalBatchMetrics(items)).toEqual({
        totalSourceBytes: 2000,
        totalResultBytes: 1000,
        netByteDifference: -1000,
        percentageReduction: 50,
      });
    });
  });

  describe('copyResultToClipboard', () => {
    it('copies SVG text to clipboard', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        writable: true,
        configurable: true,
      });

      const svgBlob = new Blob(['<svg></svg>'], { type: 'image/svg+xml' });
      const item: UniversalTaskItem = {
        id: '1',
        file: new File([], 'test.svg'),
        name: 'test.svg',
        sourceExt: 'svg',
        targetExt: 'svg',
        status: 'completed',
        progress: 100,
        resultBlob: svgBlob,
      };

      const success = await copyResultToClipboard(item);
      expect(success).toBe(true);
      expect(writeTextMock).toHaveBeenCalledWith('<svg></svg>');
    });
  });
});
