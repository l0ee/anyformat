# Security policy and architecture

Report security concerns privately through the repository owner's GitHub profile. Keep exploit details and sensitive files out of public issues:

https://github.com/l0ee

## Browser-side privacy

Image conversion, PDF page rendering, and SVG tracing run locally using browser APIs and Web Workers. The application has no file-upload backend.

The production HTML includes a Content Security Policy (CSP) that restricts connections to the site's origin and local Blob URLs. Same-origin requests are still permitted, and the site loads application assets and Google Fonts. CSP adds a layer of protection; it does not establish that the site makes no network requests.

The optional Node server sends CSP and other security headers. Static hosts use the HTML policy unless they add headers of their own. Browsers enforce multiple policies together. Vite development omits the HTML policy for React refresh and its development connection; production builds include it.

`config/security-policy.js` defines both the HTML policy and the Node server's header. It allows Blob-backed PDF preview frames and `wasm-unsafe-eval` for PDF.js codecs. JavaScript `unsafe-eval` and inline scripts remain blocked. The build bundles codec assets and their licenses from the installed PDF.js package and serves them locally.

## SVG rendering and XSS

SVG files can contain scripts and event handlers such as `<script>` and `onload`. AnyFormat handles untrusted SVG through these boundaries:

1. SVG previews use `<img>` with Blob or data URLs. Rasterization loads SVG into an `Image` and draws it to canvas. These paths do not insert SVG markup into the application's live DOM.
2. Code Inspector displays source as a React text child. Clipboard copying transfers that source as text.
3. The optimizer removes selected metadata and simplifies markup. It does not remove arbitrary scripts or event handlers. Exported SVGs can still contain active content when embedded elsewhere; image-context rendering does not sanitize the file.

## Image memory boundaries

Raster intake and conversion share a source-decode budget of 16,384 pixels per edge and 64 megapixels. The app checks recognized headers before allocating preview URLs or starting image decoding, then checks decoded dimensions during conversion. Output canvases use the smaller budget in `src/engine/canvasLimits.ts`.

The preflight reads at most 64 KiB; unknown or unsupported header layouts fall back to the browser decoder. These checks reduce memory risks but do not guarantee a fixed total-memory ceiling, prevent every decompression attack, or bound the sum of all queued files.

## External requests and self-hosting

The interface loads fonts from Google Fonts. Hosting providers and font services may receive ordinary request metadata. To make a deployment self-contained, host the fonts yourself and update both the HTML policy and any server CSP headers. Workers may have a separate policy context, so the HTML policy alone does not establish every worker's network restrictions.

The optional Node server checks canonical filesystem paths before serving assets or the SPA fallback. Symlinks may target files inside the deployment root; links outside it are rejected. Keep the build tree protected from untrusted writes: resolving a path and opening it are separate operations.

In-memory compression accepts inputs up to 8 MiB and uses at most four slots per server. A slot stays occupied until native compression completes and the response finishes or closes. Oversized files and requests at capacity stream uncompressed. HEAD requests skip file reads and compression. These limits bound compression-owned buffering, not total connections or kernel socket memory.

## Build toolchain dependencies

Tailwind CSS 4 compiles the interface through `@tailwindcss/vite`. Source paths
are declared in `src/index.css`. Build configuration comes from the repository;
it does not consume browser-selected filenames or request-provided globs.
`start-server.js` serves the generated static files without compiling CSS.

The earlier Tailwind 3 dependency tree produced five high-severity package reports
for [GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
The Tailwind 4 migration removed `braces`, `micromatch`, `fast-glob`, and `chokidar`
from the installed project tree. It also removed `postcss-nested` and the scoped
selector-parser overrides needed by the previous toolchain. The migration resolves
those dependency paths. The upstream `braces` advisory was not patched by this
project's migration.

Both full and production-only npm audits reported zero known advisories after
migration. Audits check known dependency advisories at the time they run; they
do not prove that all runtime behavior is safe. Recheck them when updating dependencies:

```bash
npm audit --json
npm audit --omit=dev --json
```

The [Tailwind 4 browser minimums](https://tailwindcss.com/docs/upgrade-guide) are
Safari 16.4, Chrome 111, and Firefox 128. Class-based themes, keyboard focus,
reduced motion, and the established UI palette and spacing have migration
regression coverage in `tests/build` and `tests/e2e`.
