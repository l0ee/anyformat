import http from 'http';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { SERVER_CSP } from './config/security-policy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.mp4': 'video/mp4',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
};

const COMPRESSIBLE_EXTENSIONS = new Set(['.html', '.js', '.mjs', '.cjs', '.css', '.json', '.map', '.txt', '.xml', '.svg']);
const MAX_COMPRESSION_BYTES = 8 * 1024 * 1024;
const MAX_COMPRESSION_JOBS = 4;
const standaloneCompressionBudget = { active: 0 };

function reserveCompression(budget) {
  if (budget.active >= MAX_COMPRESSION_JOBS) return null;
  budget.active++;
  let released = false;
  return () => {
    if (!released) {
      released = true;
      budget.active--;
    }
  };
}

function responseClosed(res) {
  return res.destroyed || res.writableEnded;
}

function compressBuffer(res, content, encoding, release, callback) {
  const tracksResponse = typeof res.once === 'function' && typeof res.off === 'function';
  let compressionDone = false;
  let responseDone = res.destroyed || res.writableFinished;
  const releaseIfDone = () => {
    if (!compressionDone || !responseDone) return;
    if (tracksResponse) {
      res.off('finish', onResponseDone);
      res.off('close', onResponseDone);
    }
    release();
  };
  const onResponseDone = () => {
    responseDone = true;
    releaseIfDone();
  };
  if (tracksResponse && !responseDone) {
    res.once('finish', onResponseDone);
    res.once('close', onResponseDone);
  }
  // end() can leave a buffered body pending. Conversely, a closed response can
  // still have zlib running. Both lifetimes must end before reusing the slot.
  const finish = (error, compressed) => {
    if (compressionDone) return;
    compressionDone = true;
    try {
      if (!responseClosed(res)) callback(error, compressed);
    } catch {
      if (typeof res.destroy === 'function') res.destroy();
      else responseDone = true;
    } finally {
      // Plain response doubles have no asynchronous flush lifecycle to track.
      if (!tracksResponse) responseDone = true;
      releaseIfDone();
    }
  };
  try {
    const compress = encoding === 'br' ? zlib.brotliCompress : zlib.gzip;
    compress(content, finish);
  } catch (error) {
    finish(error);
  }
}

function pipeFile(res, filePath, options) {
  const stream = fs.createReadStream(filePath, options);
  const cancel = () => stream.destroy();
  res.once('close', cancel);
  stream.once('close', () => res.off('close', cancel));
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}

function resolveContainedPath(distRoot, filePath, callback) {
  fs.realpath(filePath, (error, canonicalPath) => {
    if (error) {
      const parent = path.dirname(filePath);
      // A missing file inside an escaping directory must not become a SPA route.
      if (error.code === 'ENOENT' && parent !== filePath) {
        return resolveContainedPath(distRoot, parent, (parentError) => callback(parentError || error));
      }
      return callback(error);
    }
    if (canonicalPath !== distRoot && !canonicalPath.startsWith(`${distRoot}${path.sep}`)) {
      return callback(Object.assign(new Error('Outside deployment root'), { code: 'EOUTSIDE' }));
    }
    callback(null, canonicalPath);
  });
}

function resolveCanonicalFile(distRoot, filePath, callback) {
  resolveContainedPath(distRoot, filePath, (error, canonicalPath) => {
    if (error) return callback(error);
    // Serve the checked path, not the original symlink. Deployments must not be
    // concurrently mutated by untrusted users (realpath/open is not atomic).
    fs.stat(canonicalPath, (statError, stats) => callback(statError, canonicalPath, stats));
  });
}

function securityHeaders() {
  return {
    'Content-Security-Policy': SERVER_CSP,
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  };
}

function cacheControl(filePath) {
  const basename = path.basename(filePath);
  if (basename === 'index.html') return 'no-cache';
  if (basename === 'robots.txt') return 'public, max-age=3600';
  if (filePath.includes(`${path.sep}assets${path.sep}`) && /-[A-Za-z0-9_-]{6,}\./.test(basename)) {
    return 'public, max-age=31536000, immutable';
  }
  return 'public, max-age=86400';
}

function resolveRequestPath(distDir, requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl || '/', 'http://localhost').pathname);
  } catch {
    return null;
  }

  if (!pathname || pathname.includes('\0')) {
    return null;
  }

  const relativePath = pathname.replace(/^\/+/, '');
  const resolved = path.resolve(distDir, relativePath, pathname.endsWith('/') ? 'index.html' : '');
  const distRoot = path.resolve(distDir);
  if (resolved !== distRoot && !resolved.startsWith(`${distRoot}${path.sep}`)) return null;
  return { pathname, filePath: resolved };
}

export function selectEncoding(acceptEncodingHeader) {
  if (!acceptEncodingHeader || typeof acceptEncodingHeader !== 'string') {
    return null;
  }

  let brQ = null;
  let gzipQ = null;
  let wildcardQ = null;

  const parts = acceptEncodingHeader.split(',');
  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (!part) continue;

    const [encodingPart, ...paramParts] = part.split(';');
    const encoding = encodingPart.trim().toLowerCase();

    let q = 1.0;
    for (const param of paramParts) {
      const trimmed = param.trim();
      if (trimmed.startsWith('q=')) {
        const val = parseFloat(trimmed.slice(2));
        if (!isNaN(val)) {
          q = Math.max(0, Math.min(1, val));
        }
      }
    }

    if (encoding === 'br') {
      brQ = q;
    } else if (encoding === 'gzip') {
      gzipQ = q;
    } else if (encoding === '*') {
      wildcardQ = q;
    }
  }

  const effectiveBrQ = brQ !== null ? brQ : (wildcardQ !== null ? wildcardQ : 0);
  const effectiveGzipQ = gzipQ !== null ? gzipQ : (wildcardQ !== null ? wildcardQ : 0);

  if (effectiveBrQ <= 0 && effectiveGzipQ <= 0) {
    return null;
  }

  if (effectiveBrQ >= effectiveGzipQ && effectiveBrQ > 0) {
    return 'br';
  } else if (effectiveGzipQ > effectiveBrQ && effectiveGzipQ > 0) {
    return 'gzip';
  }

  return null;
}

export function sendBuffer(req, res, filePath, buffer, statusCode = 200, extraHeaders = {}) {
  if (responseClosed(res)) return;
  const extension = path.extname(filePath).toLowerCase();
  const headers = {
    ...securityHeaders(),
    'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
    'Cache-Control': cacheControl(filePath),
    'Accept-Ranges': 'bytes',
    ...extraHeaders,
  };

  const range = req.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      res.writeHead(416, { ...headers, 'Content-Range': `bytes */${buffer.length}` });
      res.end();
      return;
    }
    const requestedStart = match[1] ? Number(match[1]) : null;
    const requestedEnd = match[2] ? Number(match[2]) : null;
    const isSuffixRange = requestedStart === null;
    const start = isSuffixRange
      ? Math.max(0, buffer.length - (requestedEnd ?? 0))
      : requestedStart;
    const end = isSuffixRange || requestedEnd === null ? buffer.length - 1 : requestedEnd;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= buffer.length) {
      res.writeHead(416, { ...headers, 'Content-Range': `bytes */${buffer.length}` });
      res.end();
      return;
    }
    const boundedEnd = Math.min(end, buffer.length - 1);
    const partial = buffer.subarray(start, boundedEnd + 1);
    res.writeHead(206, {
      ...headers,
      'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${start}-${boundedEnd}/${buffer.length}`,
      'Content-Length': partial.length,
    });
    res.end(req.method === 'HEAD' ? undefined : partial);
    return;
  }

  const acceptEncoding = req.headers['accept-encoding'] || '';
  if (buffer.length > 1024 && COMPRESSIBLE_EXTENSIONS.has(extension)) {
    headers.Vary = 'Accept-Encoding';
    const encoding = selectEncoding(acceptEncoding);
    const release = encoding && req.method !== 'HEAD' && buffer.length <= MAX_COMPRESSION_BYTES
      ? reserveCompression(standaloneCompressionBudget) : null;
    if (release) {
      compressBuffer(res, buffer, encoding, release, (err, compressed) => {
        const output = err ? buffer : compressed;
        if (!err) headers['Content-Encoding'] = encoding;
        headers['Content-Length'] = output.length;
        res.writeHead(statusCode, headers);
        res.end(output);
      });
      return;
    }
  }

  headers['Content-Length'] = buffer.length;
  res.writeHead(statusCode, headers);
  res.end(req.method === 'HEAD' ? undefined : buffer);
}

function serveFile(req, res, filePath, stats, compressionBudget, metadataPath = filePath) {
  if (responseClosed(res)) return;
  const extension = path.extname(metadataPath).toLowerCase();
  const headers = {
    ...securityHeaders(),
    'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
    'Cache-Control': cacheControl(metadataPath),
    'Accept-Ranges': 'bytes',
  };

  const range = req.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      res.writeHead(416, { ...headers, 'Content-Range': `bytes */${stats.size}` });
      res.end();
      return;
    }
    const requestedStart = match[1] ? Number(match[1]) : null;
    const requestedEnd = match[2] ? Number(match[2]) : null;
    const isSuffixRange = requestedStart === null;
    const start = isSuffixRange
      ? Math.max(0, stats.size - (requestedEnd ?? 0))
      : requestedStart;
    const end = isSuffixRange || requestedEnd === null ? stats.size - 1 : requestedEnd;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= stats.size) {
      res.writeHead(416, { ...headers, 'Content-Range': `bytes */${stats.size}` });
      res.end();
      return;
    }
    const boundedEnd = Math.min(end, stats.size - 1);
    const contentLength = boundedEnd - start + 1;
    res.writeHead(206, {
      ...headers,
      'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${start}-${boundedEnd}/${stats.size}`,
      'Content-Length': contentLength,
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    pipeFile(res, filePath, { start, end: boundedEnd });
    return;
  }

  const acceptEncoding = req.headers['accept-encoding'] || '';
  const shouldCompress = stats.size > 1024 && COMPRESSIBLE_EXTENSIONS.has(extension);
  const encoding = shouldCompress ? selectEncoding(acceptEncoding) : null;

  if (COMPRESSIBLE_EXTENSIONS.has(extension)) headers.Vary = 'Accept-Encoding';
  const release = encoding && req.method !== 'HEAD' && stats.size <= MAX_COMPRESSION_BYTES
    ? reserveCompression(compressionBudget) : null;
  if (release) {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    res.once('close', cancel);
    fs.readFile(filePath, { signal: controller.signal }, (readError, content) => {
      res.off('close', cancel);
      if (readError) {
        release();
        if (!responseClosed(res)) {
          res.writeHead(500, securityHeaders());
          res.end('Server Error');
        }
        return;
      }
      if (responseClosed(res)) {
        release();
        return;
      }
      compressBuffer(res, content, encoding, release, (compError, compressed) => {
        const output = compError ? content : compressed;
        if (!compError) headers['Content-Encoding'] = encoding;
        headers['Content-Length'] = output.length;
        res.writeHead(200, headers);
        res.end(output);
      });
    });
    return;
  }

  headers['Content-Length'] = stats.size;
  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  pipeFile(res, filePath);
}

export function createProductionServer({ distDir = path.join(__dirname, 'dist') } = {}) {
  const compressionBudget = { active: 0 };
  return http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { ...securityHeaders(), Allow: 'GET, HEAD' });
      res.end('Method Not Allowed');
      return;
    }

    const resolved = resolveRequestPath(distDir, req.url);
    if (!resolved) {
      res.writeHead(400, securityHeaders());
      res.end('Bad Request');
      return;
    }

    fs.realpath(distDir, (rootError, distRoot) => {
      if (rootError) {
        if (!responseClosed(res)) {
          res.writeHead(500, securityHeaders());
          res.end('Unable to load the application');
        }
        return;
      }
      resolveCanonicalFile(distRoot, resolved.filePath, (error, canonicalPath, stats) => {
        if (responseClosed(res)) return;
        if (!error && stats.isFile()) {
          serveFile(req, res, canonicalPath, stats, compressionBudget, resolved.filePath);
          return;
        }

        if (error && error.code !== 'ENOENT' && error.code !== 'EISDIR') {
          const statusCode = error.code === 'ENOTDIR' || error.code === 'EOUTSIDE' ? 404 : error.code === 'ENAMETOOLONG' ? 400 : 500;
          res.writeHead(statusCode, securityHeaders());
          res.end(statusCode === 404 ? 'Not Found' : statusCode === 400 ? 'Bad Request' : 'Server Error');
          return;
        }

        const isClientRoute = !path.extname(resolved.pathname);
        if (isClientRoute) {
          const indexPath = path.join(distDir, 'index.html');
          resolveCanonicalFile(distRoot, indexPath, (indexStatError, canonicalIndex, indexStats) => {
            if (responseClosed(res)) return;
            if (indexStatError || !indexStats.isFile()) {
              const statusCode = indexStatError?.code === 'EOUTSIDE' ? 404 : 500;
              res.writeHead(statusCode, securityHeaders());
              res.end(statusCode === 404 ? 'Not Found' : 'Unable to load the application');
            } else {
              serveFile(req, res, canonicalIndex, indexStats, compressionBudget, indexPath);
            }
          });
          return;
        }

        res.writeHead(404, securityHeaders());
        res.end('Not Found');
      });
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const port = Number(process.env.PORT) || 8080;
  const server = createProductionServer();
  server.listen(port, () => {
    console.log(`AnyFormat production server running at http://localhost:${port}`);
  });
}
