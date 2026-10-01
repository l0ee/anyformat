import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Footer } from './Footer';

describe('Footer', () => {
  it('keeps privacy, support, and source links in a compact footer', () => {
    const html = renderToString(<Footer />);
    expect(html).toContain('AnyFormat');
    expect(html).toContain('Files stay on your device.');
    expect(html).toContain('https://github.com/l0ee/anyformat/issues');
    expect(html).toContain('Source on GitHub');
    expect(html).toContain('MIT licensed');
  });
});
