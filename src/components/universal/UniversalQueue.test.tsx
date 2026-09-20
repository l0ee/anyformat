import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { UniversalTaskItem } from '../../engine/universal/types';
import { filterUniversalTasks } from '../../engine/universal/universalFilter';
import { UniversalQueue } from './UniversalQueue';

describe('UniversalQueue Filter Integration', () => {
  const dummyItems: UniversalTaskItem[] = [
    {
      id: '1',
      file: new File([], 'alpha.png'),
      name: 'alpha.png',
      sourceExt: 'png',
      targetExt: 'webp',
      status: 'completed',
      progress: 100,
    },
    {
      id: '2',
      file: new File([], 'beta.pdf'),
      name: 'beta.pdf',
      sourceExt: 'pdf',
      targetExt: 'png',
      status: 'error',
      progress: 0,
    },
  ];

  it('filters queue items by search term correctly', () => {
    const filtered = filterUniversalTasks(dummyItems, {
      statusFilter: 'all',
      categoryFilter: 'all',
      searchQuery: 'alpha',
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('alpha.png');
  });
});

describe('UniversalQueue Component Rendering', () => {
  const defaultProps = {
    onTargetFormatChange: vi.fn(),
    onApplyAllTargetFormat: vi.fn(),
    onRemoveItem: vi.fn(),
    onClearQueue: vi.fn(),
    onStartConversion: vi.fn(),
    onDownloadItem: vi.fn(),
    onExportZip: vi.fn(),
    isProcessing: false,
  };

  it('renders Copy SVG button and delta badge for completed SVG conversions', () => {
    const items: UniversalTaskItem[] = [
      {
        id: 'item-1',
        file: { name: 'sample.png', size: 1000 } as File,
        name: 'sample.png',
        sourceExt: 'png',
        targetExt: 'svg',
        status: 'completed',
        progress: 100,
        resultSize: 400,
      },
      {
        id: 'item-2',
        file: { name: 'icon.svg', size: 2000 } as File,
        name: 'icon.svg',
        sourceExt: 'svg',
        targetExt: 'png',
        status: 'completed',
        progress: 100,
        resultSize: 1000,
      },
    ];

    const html = renderToString(
      <UniversalQueue
        {...defaultProps}
        items={items}
      />
    ).replace(/<!--.*?-->/g, '');

    // Delta badge for item-1: 400 vs 1000 => -60%
    expect(html).toContain('-60%');
    // Delta badge for item-2: 1000 vs 2000 => -50%
    expect(html).toContain('-50%');
    // Copy SVG button present for item-1 (targetExt: svg)
    expect(html).toContain('Copy SVG');
    // Batch summary shows net reduction: 1400 / 3000 => -53%
    expect(html).toContain('Saved 1.6 KB (-53%)');
  });

  it('renders single file mode with Copy SVG and Download CTA', () => {
    const items: UniversalTaskItem[] = [
      {
        id: 'single-1',
        file: { name: 'drawing.png', size: 2048 } as File,
        name: 'drawing.png',
        sourceExt: 'png',
        targetExt: 'svg',
        status: 'completed',
        progress: 100,
        resultSize: 1024,
      },
    ];

    const html = renderToString(
      <UniversalQueue
        {...defaultProps}
        items={items}
      />
    ).replace(/<!--.*?-->/g, '');

    expect(html).toContain('Convert file');
    expect(html).toContain('Copy SVG');
    expect(html).toContain('Download SVG');
    expect(html).toContain('-50%');
  });

  it('renders search and sorting toolbar when queue has more than 2 items', () => {
    const items: UniversalTaskItem[] = [
      { id: '1', file: { name: 'a.png', size: 100 } as File, name: 'a.png', sourceExt: 'png', targetExt: 'webp', status: 'idle', progress: 0 },
      { id: '2', file: { name: 'b.png', size: 200 } as File, name: 'b.png', sourceExt: 'png', targetExt: 'webp', status: 'idle', progress: 0 },
      { id: '3', file: { name: 'c.png', size: 300 } as File, name: 'c.png', sourceExt: 'png', targetExt: 'webp', status: 'idle', progress: 0 },
    ];

    const html = renderToString(
      <UniversalQueue
        {...defaultProps}
        items={items}
      />
    ).replace(/<!--.*?-->/g, '');

    expect(html).toContain('Search queued files...');
    expect(html).toContain('Default order');
    expect(html).toContain('Name (A-Z)');
    expect(html).toContain('File size');
  });
});
