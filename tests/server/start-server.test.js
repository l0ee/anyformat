import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import nodeFs from 'fs';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import http from 'http';
import { once } from 'events';
import { Duplex, PassThrough } from 'stream';
import { createProductionServer, selectEncoding, sendBuffer } from '../../start-server.js';

let fixtureRoot;
let directory;
let server;
let origin;

beforeAll(async () => {
  fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'anyformat-server-'));
  directory = path.join(fixtureRoot, 'dist');
  await fs.mkdir(directory);
  await fs.mkdir(path.join(directory, 'assets'));
  await fs.writeFile(path.join(directory, 'index.html'), '<!doctype html><title>Test app</title><main>App shell</main>');
  await fs.writeFile(path.join(directory, 'robots.txt'), 'User-agent: *\nAllow: /\n');
  await fs.writeFile(path.join(directory, 'sitemap.xml'), '<?xml version="1.0"?><urlset></urlset>');
  await fs.writeFile(path.join(directory, 'assets', 'index-AbCd1234.js'), 'const value = "compressible";'.repeat(100));
  await fs.writeFile(path.join(directory, 'background.mp4'), Buffer.from('0123456789'));
  await fs.writeFile(path.join(fixtureRoot, 'marker.txt'), 'outside deployment marker');
  await fs.symlink(path.join(fixtureRoot, 'marker.txt'), path.join(directory, 'linked.txt'));
  await fs.symlink(fixtureRoot, path.join(directory, 'outside'));
  await fs.symlink(path.join(directory, 'assets'), path.join(directory, 'inside'));
  await fs.symlink(path.join(directory, 'robots.txt'), path.join(directory, 'inside.txt'));
  await fs.writeFile(path.join(directory, 'large.txt'), Buffer.alloc(8 * 1024 * 1024 + 1, 'a'));

  server = createProductionServer({ distDir: directory });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await fs.rm(fixtureRoot, { recursive: true, force: true });
});

async function withServer(distDir, run) {
  const temporaryServer = createProductionServer({ distDir });
  await new Promise((resolve) => temporaryServer.listen(0, '127.0.0.1', resolve));
  try {
    await run(`http://127.0.0.1:${temporaryServer.address().port}`);
  } finally {
    await new Promise((resolve) => temporaryServer.close(resolve));
  }
}

function holdCompression() {
  const jobs = [];
  const finished = new Set();
  const spy = vi.spyOn(zlib, 'gzip').mockImplementation((content, callback) => {
    jobs.push({ content, callback });
  });
  return {
    jobs,
    finish(job, error = null) {
      if (finished.has(job)) return;
      finished.add(job);
      job.callback(error, error ? undefined : zlib.gzipSync(job.content));
    },
    restore() {
      for (const job of jobs) this.finish(job, new Error('Test cleanup'));
      spy.mockRestore();
    },
  };
}

function pendingResponse(holdWrites = true) {
  const pendingWrites = [];
  const req = {
    method: 'GET', url: '/assets/index-AbCd1234.js',
    httpVersionMajor: 1, httpVersionMinor: 1,
    headers: { 'accept-encoding': 'gzip' },
  };
  const socket = new Duplex({
    read() {},
    write(_chunk, _encoding, callback) {
      if (holdWrites) pendingWrites.push(callback);
      else callback();
    },
  });
  const res = new http.ServerResponse(req);
  res.assignSocket(socket);
  const headers = vi.spyOn(res, 'writeHead');
  return {
    req, res, headers,
    async flush() {
      const finished = once(res, 'finish');
      while (pendingWrites.length) pendingWrites.shift()();
      await finished;
    },
    async close() {
      if (res.destroyed) return;
      const closed = once(res, 'close');
      res.destroy();
      await closed;
    },
  };
}

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

  it('supports suffix byte ranges for media', async () => {
    const response = await fetch(`${origin}/background.mp4`, {
      headers: { Range: 'bytes=-3' },
    });
    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe('bytes 7-9/10');
    expect(await response.text()).toBe('789');
  });

  it('rejects traversal and unsupported methods', async () => {
    const traversal = await fetch(`${origin}/..%2Foutside.txt`);
    const post = await fetch(`${origin}/`, { method: 'POST' });
    expect(traversal.status).toBe(400);
    expect(post.status).toBe(405);
    expect(post.headers.get('allow')).toBe('GET, HEAD');
  });

  it.each(['GET', 'HEAD'])('survives non-directory paths and oversized path segments for %s', async (method) => {
    const nonDirectory = await fetch(`${origin}/index.html/x`, { method });
    const oversized = await fetch(`${origin}/${'a'.repeat(300)}`, { method });
    expect(nonDirectory.status).toBe(404);
    expect(oversized.status).toBe(400);
    expect(nonDirectory.headers.get('x-content-type-options')).toBe('nosniff');
    expect(oversized.headers.get('x-content-type-options')).toBe('nosniff');

    const healthy = await fetch(`${origin}/`);
    expect(healthy.status).toBe(200);
    expect(await healthy.text()).toContain('App shell');
  });

  it('handles unexpected filesystem errors without terminating the server', async () => {
    const originalStat = nodeFs.stat;
    const stat = vi.spyOn(nodeFs, 'stat').mockImplementation((filePath, callback) => {
      if (filePath === path.join(directory, 'robots.txt')) {
        queueMicrotask(() => callback(Object.assign(new Error('Permission denied'), { code: 'EACCES' })));
      } else {
        originalStat(filePath, callback);
      }
    });
    try {
      const response = await fetch(`${origin}/robots.txt`);
      expect(response.status).toBe(500);
      expect(await response.text()).toBe('Server Error');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    } finally {
      stat.mockRestore();
    }
    expect((await fetch(`${origin}/`)).status).toBe(200);
  });

  it('selects encoding respecting RFC 9110 quality values', () => {
    expect(selectEncoding('br;q=0, gzip;q=1')).toBe('gzip');
    expect(selectEncoding('br;q=0.5, gzip;q=1')).toBe('gzip');
    expect(selectEncoding('br;q=1, gzip;q=0.8')).toBe('br');
    expect(selectEncoding('gzip, deflate, br')).toBe('br');
    expect(selectEncoding('br;q=0, gzip;q=0')).toBeNull();
    expect(selectEncoding('identity')).toBeNull();
    expect(selectEncoding('*;q=0.5')).toBe('br');
    expect(selectEncoding('*;q=0')).toBeNull();
    expect(selectEncoding('')).toBeNull();
  });

  it('server respects quality values when negotiating compression', async () => {
    const gzipResponse = await fetch(`${origin}/assets/index-AbCd1234.js`, {
      headers: { 'Accept-Encoding': 'br;q=0, gzip;q=1' },
    });
    expect(gzipResponse.headers.get('content-encoding')).toBe('gzip');
    expect(await gzipResponse.text()).toContain('compressible');

    const noneResponse = await fetch(`${origin}/assets/index-AbCd1234.js`, {
      headers: { 'Accept-Encoding': 'br;q=0, gzip;q=0' },
    });
    expect(noneResponse.headers.get('content-encoding')).toBeNull();
    expect(await noneResponse.text()).toContain('compressible');
  });

  it.each(['GET', 'HEAD'])('rejects file and directory symlink escapes for %s', async (method) => {
    for (const route of ['/linked.txt', '/outside/marker.txt', '/outside/marker', '/outside/']) {
      const response = await fetch(`${origin}${route}`, { method });
      expect(response.status).toBe(404);
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(await response.text()).not.toContain('outside deployment marker');
    }
  });

  it('allows nested assets, inside-root symlinks and a symlinked deployment root', async () => {
    await fs.symlink(directory, path.join(fixtureRoot, 'deployment'));
    await withServer(path.join(fixtureRoot, 'deployment'), async (base) => {
      expect(await (await fetch(`${base}/inside.txt`)).text()).toContain('User-agent');
      const response = await fetch(`${base}/inside/index-AbCd1234.js`, {
        headers: { Range: 'bytes=0-4', 'Accept-Encoding': 'gzip' },
      });
      expect(response.status).toBe(206);
      expect(response.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
      expect(response.headers.get('content-encoding')).toBeNull();
      expect(await response.text()).toBe('const');
      expect(await (await fetch(`${base}/nested/client/route`)).text()).toContain('App shell');
    });
  });

  it('checks the SPA fallback index for symlink escapes', async () => {
    const fallbackRoot = path.join(fixtureRoot, 'fallback');
    await fs.mkdir(fallbackRoot);
    await fs.symlink(path.join(fixtureRoot, 'marker.txt'), path.join(fallbackRoot, 'index.html'));
    await withServer(fallbackRoot, async (base) => {
      for (const route of ['/', '/client/route']) {
        const response = await fetch(`${base}${route}`);
        expect(response.status).toBe(404);
        expect(await response.text()).not.toContain('outside deployment marker');
      }
    });
  });

  it('opens the checked canonical asset path while keeping request-path metadata', async () => {
    const read = vi.spyOn(nodeFs, 'createReadStream');
    try {
      const response = await fetch(`${origin}/inside.txt`, { headers: { 'Accept-Encoding': 'identity' } });
      expect(await response.text()).toContain('User-agent');
      expect(read).toHaveBeenCalledWith(path.join(directory, 'robots.txt'), undefined);
      expect(response.headers.get('cache-control')).toBe('public, max-age=86400');
    } finally {
      read.mockRestore();
    }
  });

  it.each(['gzip', 'br'])('streams assets over 8 MiB without reading or compressing the whole file (%s)', async (encoding) => {
    const read = vi.spyOn(nodeFs, 'readFile');
    const gzip = vi.spyOn(zlib, 'gzip');
    const brotli = vi.spyOn(zlib, 'brotliCompress');
    try {
      const response = await fetch(`${origin}/large.txt`, { headers: { 'Accept-Encoding': encoding } });
      expect(response.status).toBe(200);
      expect(response.headers.get('content-encoding')).toBeNull();
      expect(response.headers.get('vary')).toBe('Accept-Encoding');
      expect(response.headers.get('content-length')).toBe(String(8 * 1024 * 1024 + 1));
      expect((await response.arrayBuffer()).byteLength).toBe(8 * 1024 * 1024 + 1);
      expect(read).not.toHaveBeenCalled();
      expect(gzip).not.toHaveBeenCalled();
      expect(brotli).not.toHaveBeenCalled();
    } finally {
      read.mockRestore();
      gzip.mockRestore();
      brotli.mockRestore();
    }
  });

  it('does not read or compress HEAD responses and preserves range metadata', async () => {
    const read = vi.spyOn(nodeFs, 'readFile');
    const gzip = vi.spyOn(zlib, 'gzip');
    try {
      const response = await fetch(`${origin}/assets/index-AbCd1234.js`, {
        method: 'HEAD', headers: { 'Accept-Encoding': 'gzip' },
      });
      expect(response.headers.get('content-encoding')).toBeNull();
      expect(response.headers.get('content-length')).toBe('2900');
      expect(response.headers.get('vary')).toBe('Accept-Encoding');
      expect(await response.text()).toBe('');
      const range = await fetch(`${origin}/assets/index-AbCd1234.js`, {
        method: 'HEAD', headers: { Range: 'bytes=2-5', 'Accept-Encoding': 'gzip' },
      });
      expect(range.status).toBe(206);
      expect(range.headers.get('content-length')).toBe('4');
      expect(range.headers.get('content-range')).toBe('bytes 2-5/2900');
      expect(read).not.toHaveBeenCalled();
      expect(gzip).not.toHaveBeenCalled();
    } finally {
      read.mockRestore();
      gzip.mockRestore();
    }
  });

  it('limits parallel compression to four jobs, streams overflow and recovers capacity', async () => {
    const held = holdCompression();
    const requests = [];
    const asset = () => fetch(`${origin}/assets/index-AbCd1234.js`, { headers: { 'Accept-Encoding': 'gzip' } });
    try {
      for (let i = 0; i < 4; i++) requests.push(asset());
      await vi.waitFor(() => expect(held.jobs).toHaveLength(4));
      const overflow = await asset();
      expect(overflow.headers.get('content-encoding')).toBeNull();
      expect(overflow.headers.get('vary')).toBe('Accept-Encoding');
      expect(await overflow.text()).toContain('compressible');
      expect(held.jobs).toHaveLength(4);

      // Compression failure uses the original body and frees exactly one slot.
      held.finish(held.jobs[0], new Error('Compression failed'));
      expect((await Promise.race(requests)).headers.get('content-encoding')).toBeNull();
      requests.push(asset());
      await vi.waitFor(() => expect(held.jobs).toHaveLength(5));
      const stillFull = await asset();
      expect(stillFull.headers.get('content-encoding')).toBeNull();
      await stillFull.text();
      for (const job of held.jobs.slice(1)) held.finish(job);
      let compressedCount = 0;
      for (const request of requests) {
        const response = await request;
        if (response.headers.get('content-encoding') === 'gzip') compressedCount++;
        expect(await response.text()).toContain('compressible');
      }
      expect(compressedCount).toBe(4);
    } finally {
      held.restore();
    }
  });

  it('recovers all slots after file-read failures', async () => {
    const read = vi.spyOn(nodeFs, 'readFile').mockImplementation((_file, _options, callback) => {
      queueMicrotask(() => callback(new Error('Read failed')));
    });
    try {
      const responses = await Promise.all(Array.from({ length: 4 }, () => fetch(`${origin}/assets/index-AbCd1234.js`)));
      for (const response of responses) {
        expect(response.status).toBe(500);
        expect(await response.text()).toBe('Server Error');
      }
    } finally {
      read.mockRestore();
    }
    const held = holdCompression();
    try {
      const requests = Array.from({ length: 4 }, () => fetch(`${origin}/assets/index-AbCd1234.js`, {
        headers: { 'Accept-Encoding': 'gzip' },
      }));
      await vi.waitFor(() => expect(held.jobs).toHaveLength(4));
      for (const job of held.jobs) held.finish(job);
      for (const request of requests) expect((await request).headers.get('content-encoding')).toBe('gzip');
    } finally {
      held.restore();
    }
  });

  it('holds disconnected zlib jobs until completion, then recovers their slots', async () => {
    const held = holdCompression();
    const requests = Array.from({ length: 4 }, () => http.get(`${origin}/assets/index-AbCd1234.js`, {
      headers: { 'Accept-Encoding': 'gzip' },
    }));
    for (const request of requests) request.on('error', () => {});
    try {
      await vi.waitFor(() => expect(held.jobs).toHaveLength(4));
      await Promise.all(requests.map(async (request) => {
        const closed = new Promise((resolve) => request.once('close', resolve));
        request.destroy();
        await closed;
      }));
      const overflow = await fetch(`${origin}/assets/index-AbCd1234.js`, { headers: { 'Accept-Encoding': 'gzip' } });
      expect(overflow.headers.get('content-encoding')).toBeNull();
      await overflow.text();
      for (const job of held.jobs) held.finish(job);
      const recovered = fetch(`${origin}/assets/index-AbCd1234.js`, { headers: { 'Accept-Encoding': 'gzip' } });
      await vi.waitFor(() => expect(held.jobs).toHaveLength(5));
      held.finish(held.jobs[4]);
      expect((await recovered).headers.get('content-encoding')).toBe('gzip');
    } finally {
      for (const request of requests) request.destroy();
      held.restore();
    }
  });

  it('aborts disconnected reads and recovers capacity without starting zlib', async () => {
    const reads = [];
    const read = vi.spyOn(nodeFs, 'readFile').mockImplementation((_file, options, callback) => {
      reads.push(options.signal);
      options.signal.addEventListener('abort', () => callback(new Error('Read aborted')), { once: true });
    });
    const requests = Array.from({ length: 4 }, () => http.get(`${origin}/assets/index-AbCd1234.js`, {
      headers: { 'Accept-Encoding': 'gzip' },
    }));
    for (const request of requests) request.on('error', () => {});
    try {
      await vi.waitFor(() => expect(reads).toHaveLength(4));
      for (const request of requests) request.destroy();
      await vi.waitFor(() => expect(reads.every((signal) => signal.aborted)).toBe(true));
    } finally {
      for (const request of requests) request.destroy();
      read.mockRestore();
    }
    const healthy = await fetch(`${origin}/assets/index-AbCd1234.js`, { headers: { 'Accept-Encoding': 'gzip' } });
    expect(healthy.headers.get('content-encoding')).toBe('gzip');
    expect(await healthy.text()).toContain('compressible');
  });

  it('keeps compression capacity independent for each server', async () => {
    const held = holdCompression();
    const requests = Array.from({ length: 4 }, () => fetch(`${origin}/assets/index-AbCd1234.js`, {
      headers: { 'Accept-Encoding': 'gzip' },
    }));
    try {
      await vi.waitFor(() => expect(held.jobs).toHaveLength(4));
      await withServer(directory, async (base) => {
        const independent = fetch(`${base}/assets/index-AbCd1234.js`, { headers: { 'Accept-Encoding': 'gzip' } });
        await vi.waitFor(() => expect(held.jobs).toHaveLength(5));
        held.finish(held.jobs[4]);
        expect((await independent).headers.get('content-encoding')).toBe('gzip');
      });
      for (const job of held.jobs.slice(0, 4)) held.finish(job);
      for (const request of requests) await (await request).text();
    } finally {
      held.restore();
    }
  });

  it.each(['compressed', 'fallback'])('retains server slots for completed %s bodies until flush or close', async (output) => {
    const held = holdCompression();
    const responses = Array.from({ length: 4 }, () => pendingResponse());
    const read = vi.spyOn(nodeFs, 'createReadStream');
    try {
      for (const response of responses) server.emit('request', response.req, response.res);
      await vi.waitFor(() => expect(held.jobs).toHaveLength(4));
      for (const job of held.jobs) held.finish(job, output === 'fallback' ? new Error('Compression failed') : null);
      for (const response of responses) {
        // end() only queues bytes; real ServerResponse.finish waits for socket writes.
        expect(response.res.writableEnded).toBe(true);
        expect(response.res.writableFinished).toBe(false);
      }
      const overflow = pendingResponse(false);
      responses.push(overflow);
      const overflowFinished = once(overflow.res, 'finish');
      server.emit('request', overflow.req, overflow.res);
      await vi.waitFor(() => expect(overflow.headers.mock.calls.length > 0 || held.jobs.length > 4).toBe(true));
      expect(held.jobs).toHaveLength(4);
      expect(overflow.headers.mock.calls[0][1]['Content-Encoding']).toBeUndefined();
      expect(read).toHaveBeenCalledWith(path.join(directory, 'assets', 'index-AbCd1234.js'), undefined);
      await overflowFinished;

      await responses[0].flush();
      expect(responses[0].res.writableFinished).toBe(true);
      await responses[1].close();
      const recovered = [pendingResponse(), pendingResponse()];
      responses.push(...recovered);
      for (const response of recovered) server.emit('request', response.req, response.res);
      await vi.waitFor(() => expect(held.jobs).toHaveLength(6));
      for (const job of held.jobs.slice(4)) held.finish(job);
      for (const response of recovered) await response.flush();
    } finally {
      held.restore();
      await Promise.all(responses.map((response) => response.close()));
      read.mockRestore();
    }
  });

  it('destroys an uncompressed file stream when the response disconnects', async () => {
    const source = new PassThrough();
    const read = vi.spyOn(nodeFs, 'createReadStream').mockReturnValueOnce(source);
    const request = http.get(`${origin}/large.txt`, { headers: { 'Accept-Encoding': 'gzip' } });
    request.on('error', () => {});
    try {
      await vi.waitFor(() => expect(read).toHaveBeenCalled());
      source.write('a');
      const [response] = await once(request, 'response');
      response.destroy();
      await vi.waitFor(() => expect(source.destroyed).toBe(true));
    } finally {
      request.destroy();
      source.destroy();
      read.mockRestore();
    }
  });

  it('bounds the exported buffer helper and skips compression for HEAD and ranges', () => {
    const gzip = vi.spyOn(zlib, 'gzip');
    const res = () => ({ writeHead: vi.fn(), end: vi.fn() });
    try {
      const large = res();
      sendBuffer({ method: 'GET', headers: { 'accept-encoding': 'gzip' } }, large, 'large.txt', Buffer.alloc(8 * 1024 * 1024 + 1));
      expect(large.writeHead.mock.calls[0][1]['Content-Encoding']).toBeUndefined();
      const head = res();
      sendBuffer({ method: 'HEAD', headers: { 'accept-encoding': 'gzip' } }, head, 'small.txt', Buffer.alloc(2048));
      expect(head.end).toHaveBeenCalledWith(undefined);
      const range = res();
      sendBuffer({ method: 'GET', headers: { range: 'bytes=2-5', 'accept-encoding': 'gzip' } }, range, 'small.txt', Buffer.alloc(2048));
      expect(range.writeHead.mock.calls[0][0]).toBe(206);
      expect(range.end.mock.calls[0][0]).toHaveLength(4);
      expect(gzip).not.toHaveBeenCalled();
    } finally {
      gzip.mockRestore();
    }
  });

  it('bounds buffer-helper compression jobs and recovers from synchronous compression errors', () => {
    const held = holdCompression();
    const request = { method: 'GET', headers: { 'accept-encoding': 'gzip' } };
    const buffer = Buffer.alloc(2048, 'a');
    const responses = Array.from({ length: 5 }, () => ({ writeHead: vi.fn(), end: vi.fn() }));
    try {
      for (const response of responses) sendBuffer(request, response, 'asset.txt', buffer);
      expect(held.jobs).toHaveLength(4);
      expect(responses[4].writeHead.mock.calls[0][1]['Content-Encoding']).toBeUndefined();
      for (const job of held.jobs) held.finish(job);
    } finally {
      held.restore();
    }
    const gzip = vi.spyOn(zlib, 'gzip').mockImplementationOnce(() => { throw new Error('Cannot compress'); });
    try {
      const response = { writeHead: vi.fn(), end: vi.fn() };
      sendBuffer(request, response, 'asset.txt', buffer);
      expect(response.end).toHaveBeenCalledWith(buffer);
      expect(response.writeHead.mock.calls[0][1]['Content-Encoding']).toBeUndefined();
    } finally {
      gzip.mockRestore();
    }
  });

  it('keeps buffer-helper slots until both native work and response flushing end', async () => {
    const held = holdCompression();
    const responses = Array.from({ length: 4 }, () => pendingResponse());
    const buffer = Buffer.alloc(2048, 'a');
    try {
      for (const response of responses) sendBuffer(response.req, response.res, 'asset.txt', buffer);
      await responses[0].close();
      const overflow = pendingResponse(false);
      responses.push(overflow);
      sendBuffer(overflow.req, overflow.res, 'asset.txt', buffer);
      expect(held.jobs).toHaveLength(4); // Close alone cannot cancel native zlib work.
      held.finish(held.jobs[0]);
      expect(responses[0].res.listenerCount('finish')).toBe(0);
      expect(responses[0].res.listenerCount('close')).toBe(0);
      for (const job of held.jobs.slice(1)) held.finish(job);

      // One closed job is freed, but three completed bodies are still pending.
      const recovered = pendingResponse();
      responses.push(recovered);
      sendBuffer(recovered.req, recovered.res, 'asset.txt', buffer);
      expect(held.jobs).toHaveLength(5);
      const stillFull = pendingResponse(false);
      responses.push(stillFull);
      sendBuffer(stillFull.req, stillFull.res, 'asset.txt', buffer);
      expect(held.jobs).toHaveLength(5);
      expect(stillFull.headers.mock.calls[0][1]['Content-Encoding']).toBeUndefined();
      await responses[1].flush();
      expect(responses[1].res.listenerCount('finish')).toBe(0);
      expect(responses[1].res.listenerCount('close')).toBe(0);
      const afterFlush = pendingResponse();
      responses.push(afterFlush);
      sendBuffer(afterFlush.req, afterFlush.res, 'asset.txt', buffer);
      expect(held.jobs).toHaveLength(6);
    } finally {
      held.restore();
      await Promise.all(responses.map((response) => response.close()));
    }
  });

  it.each(['zlib throw', 'response throw'])('recovers buffered slots and cleans listeners after %s', async (failure) => {
    const buffer = Buffer.alloc(2048, 'a');
    const gzip = vi.spyOn(zlib, 'gzip').mockImplementation((content, callback) => {
      if (failure === 'zlib throw') throw new Error('Cannot compress');
      callback(null, zlib.gzipSync(content));
    });
    const responses = Array.from({ length: 4 }, () => pendingResponse());
    try {
      for (const response of responses) {
        if (failure === 'response throw') response.headers.mockImplementationOnce(() => { throw new Error('Cannot write'); });
        sendBuffer(response.req, response.res, 'asset.txt', buffer);
      }
      if (failure === 'zlib throw') {
        const overflow = pendingResponse(false);
        responses.push(overflow);
        sendBuffer(overflow.req, overflow.res, 'asset.txt', buffer);
        expect(gzip).toHaveBeenCalledTimes(4);
        await responses[0].flush();
      } else {
        await vi.waitFor(() => expect(responses.every(({ res }) => res.listenerCount('finish') === 0)).toBe(true));
      }
      const recovered = pendingResponse();
      responses.push(recovered);
      sendBuffer(recovered.req, recovered.res, 'asset.txt', buffer);
      expect(gzip).toHaveBeenCalledTimes(5);
    } finally {
      await Promise.all(responses.map((response) => response.close()));
      gzip.mockRestore();
    }
  });
});
