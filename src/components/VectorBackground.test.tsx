import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { VectorBackground } from './VectorBackground';

describe('VectorBackground Component', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('exports VectorBackground component function', () => {
    expect(typeof VectorBackground).toBe('function');
  });

  it('renders a canvas element with accessibility attributes into HTML markup', () => {
    const html = renderToString(<VectorBackground className="custom-vector-bg" />);
    expect(html).toContain('<canvas');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('custom-vector-bg');
    expect(html).toContain('pointer-events-none');
  });
});
