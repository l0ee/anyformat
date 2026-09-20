export interface TraceMetrics {
  totalPaths: number;
  totalNodes: number;
  colorLayerCount: number;
  pathComplexityHistogram: {
    lines: number;
    curves: number;
  };
  svgByteSize: number;
}

export function analyzeTraceMetrics(svgString: string): TraceMetrics {
  const byteSize = new Blob([svgString]).size;
  if (!svgString || !svgString.trim()) {
    return {
      totalPaths: 0,
      totalNodes: 0,
      colorLayerCount: 0,
      pathComplexityHistogram: { lines: 0, curves: 0 },
      svgByteSize: byteSize,
    };
  }

  if (typeof DOMParser === 'undefined') {
    const pathMatches = svgString.match(/<path[^>]*>/gi) || [];
    let totalNodes = 0;
    let lines = 0;
    let curves = 0;
    const colors = new Set<string>();

    for (const p of pathMatches) {
      const fill = /fill=["']([^"']+)["']/i.exec(p)?.[1];
      const stroke = /stroke=["']([^"']+)["']/i.exec(p)?.[1];
      if (fill && fill !== 'none') colors.add(fill.toLowerCase());
      if (stroke && stroke !== 'none') colors.add(stroke.toLowerCase());

      const d = /d=["']([^"']+)["']/i.exec(p)?.[1] || '';
      const commands = d.match(/[a-df-z]/gi) || [];
      totalNodes += commands.length;

      for (const cmd of commands) {
        const upper = cmd.toUpperCase();
        if (upper === 'L' || upper === 'H' || upper === 'V') lines += 1;
        else if (upper === 'C' || upper === 'S' || upper === 'Q' || upper === 'T') curves += 1;
      }
    }

    return {
      totalPaths: pathMatches.length,
      totalNodes,
      colorLayerCount: colors.size,
      pathComplexityHistogram: { lines, curves },
      svgByteSize: byteSize,
    };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const pathElements = Array.from(doc.querySelectorAll('path'));

  let totalNodes = 0;
  let lines = 0;
  let curves = 0;
  const colors = new Set<string>();

  for (const el of pathElements) {
    const fill = el.getAttribute('fill');
    const stroke = el.getAttribute('stroke');
    if (fill && fill !== 'none') colors.add(fill.toLowerCase());
    if (stroke && stroke !== 'none') colors.add(stroke.toLowerCase());

    const d = el.getAttribute('d') || '';
    const commands = d.match(/[a-df-z]/gi) || [];
    totalNodes += commands.length;

    for (const cmd of commands) {
      const upper = cmd.toUpperCase();
      if (upper === 'L' || upper === 'H' || upper === 'V') {
        lines += 1;
      } else if (upper === 'C' || upper === 'S' || upper === 'Q' || upper === 'T') {
        curves += 1;
      }
    }
  }

  return {
    totalPaths: pathElements.length,
    totalNodes,
    colorLayerCount: colors.size,
    pathComplexityHistogram: {
      lines,
      curves,
    },
    svgByteSize: byteSize,
  };
}
