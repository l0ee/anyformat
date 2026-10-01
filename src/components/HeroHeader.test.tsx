import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { HeroHeader } from './HeroHeader';

describe('HeroHeader Component', () => {
  it('renders Universal File Converter title for universal mode', () => {
    const html = renderToString(<HeroHeader activeTab="universal" />);
    expect(html).toContain('Convert files. Keep them private.');
  });

  it('renders Batch Vector Studio title for batch mode', () => {
    const html = renderToString(<HeroHeader activeTab="batch" />);
    expect(html).toContain('Create a cleaner SVG.');
  });

  it('renders Precision Vector Studio title for single mode', () => {
    const html = renderToString(<HeroHeader activeTab="single" />);
    expect(html).toContain('Create a cleaner SVG.');
  });
});
