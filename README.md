# AnyFormat — Universal File Converter

[![CI](https://github.com/l0ee/anyformat/actions/workflows/ci.yml/badge.svg)](https://github.com/l0ee/anyformat/actions/workflows/ci.yml)

AnyFormat is a browser-based React application for converting image formats and tracing raster images into SVG paths. It supports monochrome and layered-color output, an original/result comparison, palette adjustments, SVG markup cleanup, raster re-export, and batch ZIP downloads. All conversion paths run locally in the browser.

> Product description: an accessible, browser-based raster-to-SVG vectorizer and image-format converter with single-file and batch workflows. It uses browser APIs locally and does not include a file-upload backend.

## What it does

- **Raster-to-SVG tracing:** load PNG, JPEG, WebP, BMP, or GIF images and create monochrome or layered-color SVG output.
- **Trace controls:** adjust threshold, inversion, speckle suppression, curve smoothing, color count, and maximum trace resolution.
- **Color workflows:** create color layers with K-means quantization, inspect the extracted palette, and replace colors in the generated SVG.
- **Preview and export:** compare the original and traced result, inspect or copy the SVG markup, download SVG, or rasterize the result to PNG or WebP at 1x, 2x, or 4x.
- **SVG cleanup:** remove comments and metadata, round path coordinates, shorten eligible hex colors, and optionally minify whitespace.
- **Batch tracing:** process multiple raster images with shared settings and download completed SVG files in a ZIP archive.
- **Format conversion:** convert supported raster images between PNG, JPEG, and WebP, trace raster images to SVG, or rasterize SVG files. Exact decoder and encoder support depends on the browser.
- **Browser execution:** tracing and conversion use browser file, image, canvas, and Web Worker APIs. This repository does not implement a file-upload endpoint.

No fixed upload-size limit is enforced in the application. Practical limits depend on the selected trace resolution and the browser's available memory.

## Tech stack

- React 18 and TypeScript
- Vite 6
- Tailwind CSS and Lucide React
- JSZip for batch archives
- Canvas Confetti for interface feedback

## Supported format-conversion paths

| Input | Available outputs |
| --- | --- |
| PNG | JPEG, WebP, SVG |
| JPEG | PNG, WebP, SVG |
| WebP | PNG, JPEG, SVG |
| BMP | PNG, JPEG, WebP, SVG |
| SVG | PNG, JPEG, WebP |

Decoder support can vary between browsers. PDF and ICO conversion paths are not exposed because their current implementations are not sufficiently verified.

## Local development

### Prerequisites

- A current Node.js LTS release
- npm

Clone and install the project:

```bash
git clone https://github.com/l0ee/anyformat.git
cd anyformat
npm ci
npm run dev
```

Install Playwright browsers once before running end-to-end tests:

```bash
npx playwright install chromium firefox webkit
```

On Debian or Ubuntu, use `npx playwright install --with-deps chromium firefox webkit` if the browser system libraries are missing.

Create a feature branch before making changes:

```bash
git switch -c feature/short-description
```

Create a production build:

```bash
npm run build
```

Run the same checks used by continuous integration:

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

The end-to-end suite exercises Chromium, Firefox, and WebKit projects. It checks responsive layout, batch uploader ordering, accessible upload rejection, and real PNG, JPEG, WebP, BMP, and SVG format-conversion paths. The unit suite covers the optimizer, format-support matrix, and production server; conversion-engine edge cases should be covered before adding new advertised formats.

After building, serve the `dist` directory on `http://localhost:8080`:

```bash
npm start
```

Repository: [github.com/l0ee/anyformat](https://github.com/l0ee/anyformat)

## Deployment

The production site is deployed through GitHub Pages at [l0ee.github.io/anyformat](https://l0ee.github.io/anyformat/). The repository uses GitHub Actions as its Pages source; a successful validation job on `main` is required before the generated `dist` artifact is deployed.

Canonical, Open Graph, robots, and sitemap metadata use the configured Pages origin. For self-hosted builds, set `VITE_SITE_URL` to the public site URL.

The included Node server remains useful for local or self-hosted operation and provides compression, range requests, cache controls, MIME handling, and baseline security headers. GitHub Pages is the recommended public host for this static application.

## Repository workflow

1. Create a branch from `main`.
2. Make a focused change and run the typecheck and production build.
3. Commit the source change without `node_modules`, `dist`, or local design assets.
4. Push the branch and open a pull request.
5. Merge only after the GitHub Actions checks pass.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution checklist and [SECURITY.md](SECURITY.md) for security reporting.

## Asset publication

Files required by the website are public by design: a visitor's browser must download them to display the interface. Unused source artwork belongs in the ignored `design-assets/` directory so Vite does not copy it into the production build and Git does not publish it accidentally.

## License

Licensed under the [MIT License](LICENSE).
