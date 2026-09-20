import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { CodeInspector } from './CodeInspector';

describe('CodeInspector Component', () => {
  const defaultProps = {
    svgContent: '<svg width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>',
    optOptions: { precision: 2, removeComments: true },
    setOptOptions: vi.fn(),
    onDownloadSvg: vi.fn(),
    onDownloadPng: vi.fn(),
    onDownloadWebp: vi.fn(),
    isExporting: false,
  };

  it('enables download and copy buttons when not exporting or processing', () => {
    const html = renderToString(<CodeInspector {...defaultProps} isProcessing={false} />);
    expect(html).toContain('DOWNLOAD OPTIMIZED SVG');
    // Button should not have disabled="" attribute
    expect(html).not.toContain('disabled=""');
  });

  it('disables download and copy buttons when isProcessing is true', () => {
    const html = renderToString(<CodeInspector {...defaultProps} isProcessing={true} />);
    // Buttons should have disabled="" attribute
    expect(html).toContain('disabled=""');
  });
});
