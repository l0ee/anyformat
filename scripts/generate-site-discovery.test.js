import { describe, expect, it } from 'vitest';
import { createSiteDiscoveryFiles, resolveSiteUrl, DEFAULT_SITE_URL } from './generate-site-discovery.js';

describe('site discovery files', () => {
  it('resolves site URL from env object or falls back to default', () => {
    expect(resolveSiteUrl({ VITE_SITE_URL: 'https://mycustomsite.com' })).toBe('https://mycustomsite.com');
    expect(resolveSiteUrl({})).toBe(DEFAULT_SITE_URL);
  });

  it('uses the configured project base URL for robots and sitemap output', () => {
    const files = createSiteDiscoveryFiles('https://example.github.io/vector-app');

    expect(files['robots.txt']).toContain('Sitemap: https://example.github.io/vector-app/sitemap.xml');
    expect(files['sitemap.xml']).toContain('<loc>https://example.github.io/vector-app/</loc>');
    expect(files['sitemap.xml']).not.toContain('l0ee.github.io');
  });

  it('normalizes root origins and escapes XML-sensitive URL characters', () => {
    const files = createSiteDiscoveryFiles('https://example.com');
    const escapedFiles = createSiteDiscoveryFiles('https://example.com/brand&design');

    expect(files['robots.txt']).toContain('Sitemap: https://example.com/sitemap.xml');
    expect(files['sitemap.xml']).toContain('<loc>https://example.com/</loc>');
    expect(escapedFiles['sitemap.xml']).toContain('<loc>https://example.com/brand&amp;design/</loc>');
  });

  it('rejects invalid or unsafe site URLs', () => {
    expect(() => createSiteDiscoveryFiles('/relative/path')).toThrow(/absolute HTTP\(S\) URL/);
    expect(() => createSiteDiscoveryFiles('javascript:alert(1)')).toThrow(/HTTP\(S\) site URL/);
    expect(() => createSiteDiscoveryFiles('https://user:pass@example.com')).toThrow(/without credentials/);
  });
});
