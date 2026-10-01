# Changelog

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
