import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { createProductionServer } from '../start-server.js';

let directory;
let server;
let origin;

beforeAll(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'svg-converter-server-'));
  await fs.mkdir(path.join(directory, 'assets'));
  await fs.writeFile(path.join(directory, 'index.html'), '<!doctype html><title>Test app</title><main>App shell</main>');
  await fs.writeFile(path.join(directory, 'robots.txt'), 'User-agent: *\nAllow: /\n');
  await fs.writeFile(path.join(directory, 'sitemap.xml'), '<?xml version="1.0"?><urlset></urlset>');
  await fs.writeFile(path.join(directory, 'assets', 'index-AbCd1234.js'), 'const value = "compressible";'.repeat(100));
  await fs.writeFile(path.join(directory, 'background.mp4'), Buffer.from('0123456789'));

  server = createProductionServer({ distDir: directory });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await fs.rm(directory, { recursive: true, force: true });
});

describe('production server', () => {
  it('serves UTF-8 text with security headers', async () => {
    const response = await fetch(`${origin}/robots.txt`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('content-security-policy')).toContain("object-src 'none'");
  });

  it('serves the sitemap with the correct XML MIME type', async () => {
    const response = await fetch(`${origin}/sitemap.xml`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/xml; charset=utf-8');
    expect(await response.text()).toContain('<urlset>');
  });

  it('serves the application root for GET and HEAD requests', async () => {
    const get = await fetch(`${origin}/`);
    const head = await fetch(`${origin}/`, { method: 'HEAD' });
    expect(get.status).toBe(200);
    expect(await get.text()).toContain('App shell');
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
  });

  it('uses the SPA fallback only for extensionless routes', async () => {
    const route = await fetch(`${origin}/converter`);
    const missingAsset = await fetch(`${origin}/missing.js`);
    expect(route.status).toBe(200);
    expect(await route.text()).toContain('App shell');
    expect(missingAsset.status).toBe(404);
  });

  it('sets immutable caching and compresses hashed assets', async () => {
    const response = await fetch(`${origin}/assets/index-AbCd1234.js`, {
      headers: { 'Accept-Encoding': 'gzip' },
    });
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(response.headers.get('content-encoding')).toBe('gzip');
    expect(await response.text()).toContain('compressible');
  });

  it('supports byte ranges for media', async () => {
    const response = await fetch(`${origin}/background.mp4`, {
      headers: { Range: 'bytes=2-5' },
    });
    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe('bytes 2-5/10');
    expect(await response.text()).toBe('2345');
  });

  it('rejects traversal and unsupported methods', async () => {
    const traversal = await fetch(`${origin}/..%2Foutside.txt`);
    const post = await fetch(`${origin}/`, { method: 'POST' });
    expect(traversal.status).toBe(400);
    expect(post.status).toBe(405);
    expect(post.headers.get('allow')).toBe('GET, HEAD');
  });
});
