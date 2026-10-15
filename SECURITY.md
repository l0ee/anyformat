# Security Policy & Architecture

Please report security concerns privately through the repository owner's GitHub profile rather than opening a public issue containing exploit details or sensitive files:

https://github.com/l0ee

## Browser-Side Privacy Model

Image conversion, PDF page rendering, and SVG tracing run locally using browser APIs and Web Workers. The application has no file-upload backend.

- **Network boundaries:** The production HTML includes a Content Security Policy (CSP) that restricts connections to the site's origin and local Blob URLs. This is defense in depth, not proof of zero network activity: same-origin requests are permitted, and the site loads application assets and Google Fonts.
- **Deployment:** The included Node server also sends CSP and other security headers. Static hosts use the HTML policy unless they supply additional headers. Multiple policies are enforced together. Vite development omits the HTML policy to support React refresh and its development connection; this exception is not included in production builds.
- **Policy source:** `config/security-policy.js` generates the build's HTML policy and the Node server's header. Blob-backed frames are allowed for PDF result previews. `wasm-unsafe-eval` permits PDF.js codec compilation; JavaScript `unsafe-eval` and inline scripts remain disallowed. Codec assets and their license files are bundled from the installed PDF.js dependency and served locally.

## SVG Handling & XSS Defense

SVG files can present Cross-Site Scripting (XSS) attack vectors due to embedded scripts or event handlers (`<script>`, `onload`, etc.). AnyFormat mitigates SVG injection risks through:

1. **Image-context rendering:** SVG previews use `<img>` with Blob or data URLs. Rasterization loads SVG into an `Image` and draws it to canvas. These paths do not insert SVG markup into the application's live DOM.
2. **Text inspection:** Code Inspector displays SVG source as a React text child, rather than injecting it as HTML. Clipboard copying transfers the source as text.
3. **Optimization is not sanitization:** The SVG optimizer removes selected metadata and simplifies markup. It does not strip arbitrary scripts or event handlers and must not be treated as a security sanitizer. Image-context rendering does not make the underlying SVG safe to embed as active markup elsewhere.

## Image memory boundaries

Raster intake and conversion share a source-decode budget of 16,384 pixels per edge and 64 megapixels. Recognized image headers are checked before allocating source preview URLs or starting browser image decoding. Conversion paths also check decoded dimensions. Output canvases use the smaller budget in `src/engine/canvasLimits.ts`.

The preflight reads at most 64 KiB; unknown or unsupported header layouts fall back to the browser decoder. These checks reduce memory risks but do not guarantee a fixed total-memory ceiling, prevent every decompression attack, or bound the sum of all queued files.

## External Dependencies & Self-Hosting

The interface loads web fonts from Google Fonts. Hosting providers and font services may receive ordinary request metadata. A self-contained deployment requires self-hosting the fonts and updating both the HTML policy and any server CSP headers. Worker resources may have their own policy context; the HTML policy alone is not a guarantee about every worker's network access.

## Build toolchain dependencies

Tailwind CSS 4 compiles the interface through `@tailwindcss/vite`. Source paths
are declared in `src/index.css`; build configuration remains repository-controlled
and does not consume browser-selected filenames or request-provided globs.
`start-server.js` serves the generated static files without compiling CSS.

The earlier Tailwind 3 dependency tree produced five high-severity package reports
for [GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
The Tailwind 4 migration removed `braces`, `micromatch`, `fast-glob`, and `chokidar`
from the installed project tree. It also removed `postcss-nested` and the scoped
selector-parser overrides needed by the previous toolchain. The migration resolves
those dependency paths without claiming that the upstream `braces` advisory has
been patched.

Both full and production-only npm audits reported zero known advisories after
migration. Audit results are a point-in-time dependency check, not proof that all
runtime behavior is safe. Recheck them when updating dependencies:

```bash
npm audit --json
npm audit --omit=dev --json
```

The [Tailwind 4 browser minimums](https://tailwindcss.com/docs/upgrade-guide) are
Safari 16.4, Chrome 111, and Firefox 128. Class-based themes, keyboard focus,
reduced motion, and the established UI palette and spacing have migration
regression coverage in `tests/build` and `tests/e2e`.
