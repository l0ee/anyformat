import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { HeroHeader } from './HeroHeader';

describe('HeroHeader Component', () => {
  it('renders Universal File Converter title for universal mode', () => {
    const html = renderToString(<HeroHeader activeTab="universal" />);
    expect(html).toContain('Universal File Converter');
  });

  it('renders Batch Vector Studio title for batch mode', () => {
    const html = renderToString(<HeroHeader activeTab="batch" />);
    expect(html).toContain('Batch Vector Studio');
  });

  it('renders Precision Vector Studio title for single mode', () => {
    const html = renderToString(<HeroHeader activeTab="single" />);
    expect(html).toContain('Precision Vector Studio');
  });
});
