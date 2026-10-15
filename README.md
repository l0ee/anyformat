# AnyFormat

AnyFormat lets you convert images in batches, trace images into SVGs, and export PDF pages in your browser.

[Open the live demo](https://l0ee.github.io/anyformat/) · [Report an issue](https://github.com/l0ee/anyformat/issues)

[![CI](https://github.com/l0ee/anyformat/actions/workflows/ci.yml/badge.svg)](https://github.com/l0ee/anyformat/actions/workflows/ci.yml)

![AnyFormat Vector Studio showing an original image and its traced SVG](docs/images/vector-studio.png)

## Workspaces

| Workspace | What it does |
| --- | --- |
| Format Converter | Convert images and selected PDF pages. Preview the results, then download individual files or a batch ZIP. |
| Vector Studio | Trace a raster image into SVG. Adjust detail and colors, compare the result with the original, and inspect the SVG source. |
| Vector Batch | Trace multiple images with the same settings and download the SVGs together. |

## Supported formats

| Format Converter input | Available outputs |
| --- | --- |
| PNG | JPEG, WebP, SVG, PDF, PNG |
| JPEG | PNG, WebP, SVG, PDF, JPEG |
| WebP | PNG, JPEG, SVG, PDF, WebP |
| BMP | PNG, JPEG, WebP, SVG, PDF |
| SVG | PNG, JPEG, WebP, PDF |
| PDF | PNG, JPEG, WebP, SVG |

Vector Studio and Vector Batch accept PNG, JPEG, WebP, BMP, and GIF. Format Converter does not support GIF. Supported conversion paths are defined in [`src/engine/universal/types.ts`](src/engine/universal/types.ts).

PDF conversion exports one selected page at a time. PDF-to-SVG traces an image of that page; it does not preserve the original text or vector objects. Tracing works best with simple logos and illustrations. Results depend on the source image and your settings.

Each file can be up to 100 MB, and each queue can hold up to 100 files. Format support also depends on the codecs available in your browser.

## Privacy

Your files stay on your device. All conversions run in your browser, and AnyFormat has no file-upload backend. The site still makes network requests to load application assets and Google Fonts. The production Content Security Policy (CSP) restricts which resources can load. See [SECURITY.md](SECURITY.md) for rendering boundaries and deployment details.

## Run locally

You need Node.js 22.12 or newer within Node 22, and npm 10, as specified in `package.json`.

The interface targets Safari 16.4+, Chrome 111+, and Firefox 128+, the minimum
browser versions for Tailwind CSS 4. The `@tailwindcss/vite` plugin compiles CSS.
Input sources and class-based dark mode are declared in `src/index.css`.
The UI's colors and spacing come from `tailwind.config.js` and compatibility
utilities in `src/index.css`.

```bash
git clone https://github.com/l0ee/anyformat.git
cd anyformat
npm ci
npm run dev
```

To build and run the production version locally:

```bash
npm run build
npm start
```

The server serves `dist` at `http://localhost:8080` by default. To deploy on another host, set `VITE_SITE_URL` when building. Set `VITE_BASE_PATH` if you deploy under a subdirectory.

Put website assets in `public`. Keep unused source artwork in `design-assets`, which Git ignores.

## Checks

```bash
npm run typecheck && npm run lint && npm test
npx playwright install chromium
npx playwright test --project=chromium
```

Unit tests live alongside the source files and scripts they cover. Server tests are in `tests/server`, and browser tests are in `tests/e2e`. The full browser suite (`npm run test:e2e`) also runs Firefox and WebKit. Install those browsers and their required system libraries before running it.

If you hit the ICU/JPEG ABI mismatch on Nobara/Fedora, use the tested
[rootless WebKit setup](docs/webkit-on-fedora.md).

[Contributing](CONTRIBUTING.md) · [Security policy](SECURITY.md) · [MIT license](LICENSE)
