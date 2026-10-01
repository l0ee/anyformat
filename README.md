# AnyFormat 2

**Image and PDF conversion. SVG tools. All in your browser.**

[![CI](https://github.com/l0ee/anyformat/actions/workflows/ci.yml/badge.svg)](https://github.com/l0ee/anyformat/actions/workflows/ci.yml)

AnyFormat helps you change image formats, turn pictures into SVG graphics, and export individual PDF pages. Preview your results, adjust the settings, and download one file or a batch. Your files are processed on your device and are never uploaded to a conversion server.

[Open AnyFormat](https://l0ee.github.io/anyformat/) · [Report a problem](https://github.com/l0ee/anyformat/issues) · [Contribute](CONTRIBUTING.md)

## What's new in Version 2

Version 2 puts the file tools first: a cleaner layout, two main modes, and fewer settings to work through. The upload area includes a small pixel-to-vector motion graphic that you can pause. It also respects your device's reduced-motion setting.

- **Convert files** for image formats and selected PDF pages.
- **Create SVG** for a single image or a batch, with automatic batch routing when you add several images.
- **Simpler settings:** start with a style and expand advanced controls when you need them.
- **Mobile-friendly workflows:** the upload action is visible on the first screen, previews appear before settings, and downloads remain easy to find.

See [CHANGELOG.md](CHANGELOG.md) for the release history. No installation or account is required to use the website on a desktop or phone.

## Choose the right workspace

| Workspace | What you can do |
| --- | --- |
| **Convert files** | Convert supported images, SVG files, and PDF pages. Choose an output for each file, preview results, and download completed files. |
| **Create SVG** | Turn a picture into an SVG: a graphic made from shapes and curves that can scale without losing sharpness. Adjust colors and detail, then compare the result with the original. Add several images to use shared batch settings and export a ZIP. |

## How to use it

1. **Add your files.** Choose files, drag them into the upload area, or paste a supported image from your clipboard.
2. **Choose your output.** Pick a format in Convert files, or choose a style in Create SVG. For PDFs, choose the page you want to convert. Advanced SVG settings and source code are available in expandable sections.
3. **Preview and download.** Check the result, download a file, or export completed batch results as a ZIP.

## Features

- **Image and PDF conversion:** work with PNG, JPEG, WebP, BMP, SVG, and PDF files using the supported paths below.
- **Editable SVG output:** create black-and-white or color graphics, adjust the level of detail, and edit the color palette.
- **Before-and-after previews:** compare the source with the result and use the fullscreen view for a closer look.
- **SVG tools:** inspect or copy SVG code, remove unnecessary metadata, and simplify the output.
- **Flexible exports:** download SVG files, export traced results as PNG or WebP at different sizes, or collect completed files in a ZIP.
- **Batch workflows:** use shared tracing settings, choose formats per file, and retry failed conversions.
- **Accessible controls:** keyboard shortcuts, labeled inputs, responsive layouts, and light and dark themes.

## Supported formats

### Convert files

| Input | Available outputs |
| --- | --- |
| PNG | JPEG, WebP, SVG, PDF |
| JPEG | PNG, WebP, SVG, PDF |
| WebP | PNG, JPEG, SVG, PDF |
| BMP | PNG, JPEG, WebP, SVG, PDF |
| SVG | PNG, JPEG, WebP, PDF |
| PDF | PNG, JPEG, WebP, SVG |

### Create SVG: single-image and batch workflows

Create SVG accepts **PNG, JPEG, WebP, BMP, and GIF** images for tracing. GIF is not offered in Convert files.

### What to expect

- **PDF conversion works one selected page at a time.** PDF-to-SVG creates a traced version of the rendered page; it does not preserve the original text or vector objects.
- **SVG tracing redraws a picture as shapes.** Simple logos and illustrations usually need less tuning than detailed photos. Results depend on your image and settings.
- **Files are limited to 100 MB each.** Batch queues hold up to 100 files. Large images may be resized to stay within browser memory limits.
- **Browser support can vary.** A format listed here may still depend on your browser's image decoder or encoder. Unsupported paths, including ICO conversion, are not offered.

The supported-format definitions are maintained in [`src/engine/universal/types.ts`](src/engine/universal/types.ts).

## Privacy

Image processing and conversion run locally in your browser. AnyFormat has no file-upload backend, and it does not send your source files to a conversion service. The website still loads its application files and fonts when you open it.

## Run locally

Use **Node.js 22** and **npm 10**, as specified in `package.json`.

```bash
git clone https://github.com/l0ee/anyformat.git
cd anyformat
npm ci
npm run dev
```

Open the local address printed by Vite.

### Build and serve

```bash
npm run build
npm start
```

The production build is written to `dist`. The included server runs at **http://localhost:8080** by default.

## Development and testing

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server. |
| `npm run typecheck` | Check TypeScript types. |
| `npm run lint` | Check code style and common mistakes. |
| `npm test` | Run unit tests. |
| `npm run test:e2e` | Run browser tests in Chromium, Firefox, and WebKit. |
| `npm run build` | Create the production site. |

Install the test browsers before running the browser suite:

```bash
npx playwright install chromium firefox webkit
```

On Debian or Ubuntu, add `--with-deps` if browser system libraries are missing. To run only Chromium, use `npx playwright test --project=chromium`.

Tests cover conversion paths, tracing, file limits, previews, queue behavior, accessibility, and the production server. New formats should have verified conversion paths before they are advertised.

## Built with

- **React 18 and TypeScript** for the interface and application logic.
- **Vite 6 and Tailwind CSS** for development, builds, and styling.
- **Browser Canvas and Web Workers** for image processing and background tracing.
- **PDF.js and pdf-lib** for reading PDF pages and creating PDF files.
- **JSZip** for batch downloads and **Lucide React** for interface icons.

## Deployment

The public site is hosted on [GitHub Pages](https://l0ee.github.io/anyformat/). GitHub Actions validates changes and deploys successful builds from `main`.

For another host, serve the generated `dist` folder and set `VITE_SITE_URL` to your public site address when building. Set `VITE_BASE_PATH` if the app will live under a subdirectory. The included Node server also supports self-hosting, with compression, caching, range requests, and security headers.

Website assets belong in `public`. Keep unused source artwork in the ignored `design-assets` directory.

### Versioned releases

The website updates when a validated change is merged into `main` and GitHub Pages deployment succeeds. A GitHub release records the source version separately: `v2.0.0` identifies Version 2. Creating a release alone does not deploy the website. The version displayed in the footer comes from `package.json`.

## Contributing and support

Have an idea or found a problem? [Open an issue](https://github.com/l0ee/anyformat/issues). For code changes, create a focused branch and follow [CONTRIBUTING.md](CONTRIBUTING.md). See [SECURITY.md](SECURITY.md) for security reports.

## License

AnyFormat is released under the [MIT License](LICENSE).
