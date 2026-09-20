import { describe, expect, it } from 'vitest';
import { analyzeTraceMetrics } from './traceMetrics';

describe('analyzeTraceMetrics', () => {
  it('handles empty or blank SVG strings', () => {
    const metrics = analyzeTraceMetrics('');
    expect(metrics).toEqual({
      totalPaths: 0,
      totalNodes: 0,
      colorLayerCount: 0,
      pathComplexityHistogram: { lines: 0, curves: 0 },
      svgByteSize: 0,
    });
  });

  it('correctly calculates metrics for a multi-path SVG', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <path fill="#FF0000" d="M 10 10 L 90 10 C 90 50 50 90 10 90 Z" />
        <path stroke="#00FF00" fill="none" d="M 0 0 H 50 V 50 Q 25 25 0 0 Z" />
      </svg>
    `;

    const metrics = analyzeTraceMetrics(svg);
    expect(metrics.totalPaths).toBe(2);
    expect(metrics.colorLayerCount).toBe(2); // #ff0000 fill and #00ff00 stroke
    expect(metrics.pathComplexityHistogram.lines).toBe(3); // L, H, V
    expect(metrics.pathComplexityHistogram.curves).toBe(2); // C, Q
    expect(metrics.totalNodes).toBe(9);
    expect(metrics.svgByteSize).toBeGreaterThan(0);
  });
});
