import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Footer } from './Footer';

describe('Footer Component', () => {
  it('renders footer sections, links, and feature trust badges', () => {
    const html = renderToString(<Footer />);

    // Brand and about
    expect(html).toContain('AnyFormat');
    expect(html).toContain('About us');
    expect(html).toContain('Vector tools');
    expect(html).toContain('Format tools');
    expect(html).toContain('Git Repo');

    // Feature trust badges
    expect(html).toContain('Zero Server Uploads');
    expect(html).toContain('100% In-Browser');
    expect(html).toContain('Vector Studio Integrated');

    // Bottom copyright and license
    expect(html).toContain('MIT licensed');
    expect(html).toContain('View the source on GitHub');
  });
});
