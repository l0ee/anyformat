import { describe, expect, it } from 'vitest';
import type { TraceResult } from '../engine/types';
import { restoreTraceDimensions } from './traceWorkerUtils';

function createResult(): TraceResult {
  return {
    svg: '<svg width="1024" height="512" viewBox="0 0 1024 512"><path d="M0 0h1024v512Z" /></svg>',
    width: 1024,
    height: 512,
    pathCount: 1,
    nodeCount: 4,
  };
}

describe('restoreTraceDimensions', () => {
  it('scales the traced coordinate space to the original viewport', () => {
    const result = restoreTraceDimensions(createResult(), 2048, 1024);

    expect(result.width).toBe(2048);
    expect(result.height).toBe(1024);
    expect(result.svg).toContain('width="2048" height="1024" viewBox="0 0 1024 512"');
    expect(result.svg).toContain('d="M0 0h1024v512Z"');
  });

  it('returns the result unchanged when dimensions already match', () => {
    const original = createResult();

    expect(restoreTraceDimensions(original, 1024, 512)).toBe(original);
  });

  it('updates dimensions when root attributes use alternate quoting or order', () => {
    const original = createResult();
    original.svg = '<svg viewBox="0 0 1024 512" height=\'512\' width=\'1024\'><path d="M0 0"/></svg>';

    const result = restoreTraceDimensions(original, 2048, 1024);

    expect(result.svg).toContain('viewBox="0 0 1024 512" height="1024" width="2048"');
  });
});
