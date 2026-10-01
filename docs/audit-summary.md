# Audit and publication summary

This document records verified safeguards and repository boundaries. It is not a guarantee that every possible defect or historical secret has been checked.

## Verified application safeguards

| Area | Safeguard | Maintained evidence |
| --- | --- | --- |
| Production server | Rejects invalid request paths, handles range requests, and applies security headers. | `test/start-server.test.js` |
| ZIP exports | Resolves filename collisions instead of overwriting results. | `src/engine/zipExporter.test.ts` |
| SVG processing | Validates canvas dimensions and resolves SVG sizes before rasterizing. | `src/engine/svgRasterizer.test.ts` |
| Tracing | Checks contour behavior, transparency, viewBox dimensions, and color-layer output. | Monochrome/color tracer tests and `tracingIntegration.test.ts` |
| Worker lifecycle | Queues tasks, isolates transferred bytes, handles failures, and supports cancellation. | `src/workers/traceWorkerClient.test.ts` |
| Conversion workflows | Preserves PDF page filenames, keeps completed results on stop, and discards late cancelled results. | Converter unit tests and browser workflow tests |
| Supported formats | Capabilities are defined in one registry and checked by tests. | `src/engine/universal/types.ts` and its tests |
| UI behavior | Tests cover keyboard controls, previews, mobile layout, and reduced-motion preferences. | `tests/e2e/` |

Run the normal checks with `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. Install Playwright's browser dependencies before running `npm run test:e2e`. Required CI checks Chromium, Firefox, and WebKit before deployment.

The additional `npm run test:stress` command checks monochrome and color tracing at 3840×2160. It is opt-in to keep regular tests lightweight; passing it does not establish safe performance for every large input or device.

## Files that belong in the repository

- Active source code, public assets required by the website, and maintained tests.
- Package manifests and lockfiles, build scripts, CI workflows, and release documentation.
- The license, contribution/security guidance, and concise project instructions in `AGENTS.md`.
- Creator attribution in the interface, page metadata, and exported-file metadata.

Unused assets in `public/` are copied into builds even when the interface never references them. Archive retired artwork locally rather than leaving it in the deployment directory. Server tests create their own media fixture; they do not require the retired background video.

## Files that stay local

- Dependency folders, build output, browser reports, coverage, logs, crash dumps, and environment configuration.
- Private notes, archived source artwork, and retired experiments in ignored directories.
- Personal agent configuration, downloaded skills, and session data. Use Git's local `info/exclude` for personal tooling; use the shared `.gitignore` for project-wide generated files.

Only reviewed, non-sensitive environment examples should be committed. Variables prefixed with `VITE_` can be exposed in browser builds and must not contain credentials. Do not place private data in `public/`.

## Review scope

The publication cleanup removed obsolete effects, unused helpers, an unreferenced video, and unregistered diagnostic scripts. Useful synthetic-image checks were moved into the normal test suite; 4K checks became a documented opt-in stress test.

The previous execution plan was archived locally. It contained obsolete agent instructions and a machine-specific link that was unusable by contributors. No history rewriting or credential rotation was performed as part of this cleanup.
