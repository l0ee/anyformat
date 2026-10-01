import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ResultSizeSummary } from './ResultSizeSummary';

describe('result size comparison', () => {
  it('reports growth instead of promising compression', () => {
    const html = renderToStaticMarkup(<ResultSizeSummary sourceBytes={1024} resultBytes={1536} />);
    expect(html).toContain('50% larger');
    expect(html).toContain('Output: 1.5 KB');
  });
  it('reports reduction and handles zero-byte inputs without infinity', () => {
    expect(renderToStaticMarkup(<ResultSizeSummary sourceBytes={2048} resultBytes={1024} />)).toContain('50% smaller');
    const empty = renderToStaticMarkup(<ResultSizeSummary sourceBytes={0} resultBytes={128} />);
    expect(empty).not.toMatch(/Infinity|NaN/);
  });
});
