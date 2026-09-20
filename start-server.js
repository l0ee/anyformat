import http from 'http';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

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

function securityHeaders() {
  return {
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ].join('; '),
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
    if (encoding === 'br') {
      zlib.brotliCompress(buffer, (err, compressed) => {
        if (err) {
          headers['Content-Length'] = buffer.length;
          res.writeHead(statusCode, headers);
          res.end(req.method === 'HEAD' ? undefined : buffer);
        } else {
          headers['Content-Encoding'] = 'br';
          headers['Content-Length'] = compressed.length;
          res.writeHead(statusCode, headers);
          res.end(req.method === 'HEAD' ? undefined : compressed);
        }
      });
      return;
    } else if (encoding === 'gzip') {
      zlib.gzip(buffer, (err, compressed) => {
        if (err) {
          headers['Content-Length'] = buffer.length;
          res.writeHead(statusCode, headers);
          res.end(req.method === 'HEAD' ? undefined : buffer);
        } else {
          headers['Content-Encoding'] = 'gzip';
          headers['Content-Length'] = compressed.length;
          res.writeHead(statusCode, headers);
          res.end(req.method === 'HEAD' ? undefined : compressed);
        }
      });
      return;
    }
  }

  headers['Content-Length'] = buffer.length;
  res.writeHead(statusCode, headers);
  res.end(req.method === 'HEAD' ? undefined : buffer);
}

function serveFile(req, res, filePath, statusCode = 200, extraHeaders = {}) {
  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      res.writeHead(404, securityHeaders());
      res.end('Not Found');
      return;
    }

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
      const stream = fs.createReadStream(filePath, { start, end: boundedEnd });
      stream.on('error', () => {
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
      stream.pipe(res);
      return;
    }

    const acceptEncoding = req.headers['accept-encoding'] || '';
    const shouldCompress = stats.size > 1024 && COMPRESSIBLE_EXTENSIONS.has(extension);
    const encoding = shouldCompress ? selectEncoding(acceptEncoding) : null;

    if (encoding) {
      headers.Vary = 'Accept-Encoding';
      fs.readFile(filePath, (readError, content) => {
        if (readError) {
          res.writeHead(500, securityHeaders());
          res.end('Server Error');
          return;
        }
        const compressFn = encoding === 'br' ? zlib.brotliCompress : zlib.gzip;
        compressFn(content, (compError, compressed) => {
          if (compError) {
            headers['Content-Length'] = content.length;
            res.writeHead(statusCode, headers);
            res.end(req.method === 'HEAD' ? undefined : content);
          } else {
            headers['Content-Encoding'] = encoding;
            headers['Content-Length'] = compressed.length;
            res.writeHead(statusCode, headers);
            res.end(req.method === 'HEAD' ? undefined : compressed);
          }
        });
      });
      return;
    }

    if (COMPRESSIBLE_EXTENSIONS.has(extension)) {
      headers.Vary = 'Accept-Encoding';
    }
    headers['Content-Length'] = stats.size;
    res.writeHead(statusCode, headers);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
    stream.pipe(res);
  });
}

export function createProductionServer({ distDir = path.join(__dirname, 'dist') } = {}) {
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

    fs.stat(resolved.filePath, (error, stats) => {
      if (!error && stats.isFile()) {
        serveFile(req, res, resolved.filePath);
        return;
      }

      const isNotFound = !error || error.code === 'ENOENT' || error.code === 'EISDIR' || !stats.isFile();
      const isClientRoute = isNotFound && !path.extname(resolved.pathname);
      if (isClientRoute) {
        const indexPath = path.join(distDir, 'index.html');
        fs.stat(indexPath, (indexStatError, indexStats) => {
          if (indexStatError || !indexStats.isFile()) {
            res.writeHead(500, securityHeaders());
            res.end('Unable to load the application');
          } else {
            serveFile(req, res, indexPath);
          }
        });
        return;
      }

      res.writeHead(isNotFound ? 404 : 500, securityHeaders());
      res.end(isNotFound ? 'Not Found' : 'Server Error');
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
