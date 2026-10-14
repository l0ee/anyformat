# Changelog

## 2.2.1 — Workspace refresh and server hardening (2026-10-14)

- Refresh light and dark themes, responsive layouts, upload actions, tracing controls, and result styling. Add landing feature cards that open the matching workspace and return keyboard focus to the tool.
- Improve theme-button state, creator-link labeling, touch targets, modal styling, and keyboard/reduced-motion regression coverage. Keep conversion and tracing entirely browser-side.
- Check canonical deployment-root containment for assets, symlinked directories, missing ancestors, and the SPA fallback while preserving request-path MIME and cache metadata.
- Limit compression to 8 MiB per asset and four jobs per server (with a separate buffer-helper pool). Hold capacity until native work and response flushing finish; clean up aborted reads and disconnected streams.
- Retain environment-file exclusions, reviewed example exceptions, and local experiment/report/crash-dump ignore protections.

## 2.2.0 — Image exports and conversion reliability

### New

- Resize raster outputs, preserve aspect ratio, control JPEG/WebP quality, and choose a JPEG background. PNG, JPEG, and WebP can also export to the same format with these settings.
- Save-image guidance and capability-checked native file sharing. Vector Studio can prepare a PNG or WebP for a separate save/share tap.
- Bounded parallel SVG batch tracing, debounced SVG cleanup, and off-screen queue rendering that retains keyboard access.

### Fixed

- Flatten and normalize ZIP entry names, including case-insensitive collisions, without dropping completed files.
- Check raster headers before preview allocation and decoding; release raster-export URLs and canvases on failures.
- Validate default output formats before queueing files, and invalidate stale conversion results when settings change.
- Preserve requested resize dimensions despite floating-point rounding, and recognize CORE-header BMP dimensions during image preflight.
- Bundle PDF.js codecs locally, apply the same production CSP to static and Node deployments, and preserve embedded JPEG rendering in WebKit.

### Maintenance

- Migrate to Tailwind CSS 4.3.3 and its Vite plugin, retaining the existing palette, layout, themes, keyboard focus, and reduced-motion behavior. Remove the vulnerable Tailwind 3 dependency chain and update `source-map-js` to 1.2.2.
- Retain the 2.1 stop/resume controls, named stages, file-count progress, partial ZIP exports, individual SVG downloads, result-size comparisons, and creator attribution.
- Document rootless WebKit verification on Nobara/Fedora. Native sharing targets and Photos saving still require physical-device verification; see [mobile saving and sharing](docs/mobile-saving-and-sharing.md).

## 2.1.0 — Smoother workflows

### New

- Named conversion stages and a batch-level count of finished files. Active operations use an indeterminate indicator instead of an invented time percentage.
- Stop processing in both conversion and SVG batch queues. Completed results are preserved, interrupted files return to Ready, and remaining files can resume.
- Individual SVG downloads and ZIP export while a batch is still processing.
- Original/output size summaries in the SVG editor and batch results, including when output files are larger.
- Clear drag acknowledgement, a comparison-handle hint, and subtle style-selection feedback that respect reduced-motion preferences.
- A visible **by l0ee** link to the repository, plus creator metadata in the page source.

### Notes

- Worker tracing can stop promptly. Canvas/PDF operations that cannot be interrupted finish their current browser step before the queue unlocks; late results are discarded and no further files start.
- File counts measure completed work, not elapsed-time estimates. File size comparisons do not imply equal visual quality.
- Processing remains browser-side with no file-upload backend. Supported formats and file limits are unchanged.

## 2.0.0 — Clean workspace redesign

Version 2 is the redesigned second generation of AnyFormat and its first tagged GitHub release. Earlier development remains in the repository history; no formal Version 1 release was tagged.

### New

- Two main modes: **Convert files** and **Create SVG**.
- A reusable, compact upload surface for image and PDF workflows.
- Automatic batch routing when several images are added to Create SVG.
- A custom pixel-to-vector motion illustration, with pause/resume and reduced-motion support.
- A visible app version in the footer.

### Improved

- A neutral interface with clearer navigation, smaller headings, and a compact footer.
- Mobile upload actions visible on the first screen and previews before tracing settings.
- Basic tracing controls kept visible; advanced settings and SVG code placed in expandable sections.
- Plain-language styles: Clean logo, Detailed image, and Simple illustration.
- Existing conversion, preview, download, PDF-page naming, and ZIP-export behavior retained.

### Removed

- The full-page ambient ribbon effect and its floating motion control, replaced by the smaller upload illustration.
- Large default feature panels; supporting product information is now expandable.

### Compatibility

- File conversion remains browser-side, with no file-upload backend.
- Supported format paths and file limits are unchanged.
- Browser decoder/encoder support and device memory still affect conversion availability and large-file processing.
