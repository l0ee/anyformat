// Shared by Vite's static HTML and the optional Node production server.
export const PRODUCTION_CSP = [
  "default-src 'self'",
  // PDF.js codecs compile WASM; JavaScript eval and inline scripts stay blocked.
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "connect-src 'self' blob:",
  "object-src 'none'",
  // PDF result previews are Blob URLs, not remote embedded documents.
  "frame-src blob:",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

// frame-ancestors cannot be enforced through an HTML meta policy.
export const SERVER_CSP = `${PRODUCTION_CSP}; frame-ancestors 'none'`;
