# Changelog

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
