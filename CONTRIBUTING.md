# Contributing

Use Node.js 22 (22.12 or later) and npm 10.

## Development flow

1. Fork or clone the repository.
2. Run `npm ci`.
3. Create a focused branch from `main`.
4. Make the change without committing `node_modules`, `dist`, or `design-assets`.
5. Run `npm run lint`, `npm run typecheck`, and `npm run build`.
6. Test affected controls with a keyboard and at a narrow viewport.
7. Open a pull request describing the behavior change and validation performed.

Run `npm test` for unit tests and `npm run test:e2e` for browser tests. Both suites run in CI along with lint, typecheck, and build.

`main` requires a pull request with a passing `validate` GitHub Actions check. The owner reviews the diff and checks before merging; a second approval is not currently required. If collaborators are added, require one approval.

Install Playwright browsers before running the end-to-end suite locally:

```bash
npx playwright install chromium firefox webkit
```

On Debian or Ubuntu, use `npx playwright install --with-deps chromium firefox webkit` when the host is missing browser system libraries.

For the tested rootless WebKit setup on Nobara/Fedora, see [docs/webkit-on-fedora.md](docs/webkit-on-fedora.md). Mobile sharing tests mock native APIs. The pending physical-device checks are listed in [docs/mobile-saving-and-sharing.md](docs/mobile-saving-and-sharing.md).

Keep conversion-format claims consistent with `src/engine/universal/types.ts`. Verify decoders, encoders, file limits, privacy claims, and third-party engines before documenting them.

## Commit scope

Keep each commit focused on one change. Use an imperative subject, such as `Fix universal target intersection` or `Improve batch queue status semantics`.

## Local files and publication

Keep environment files, logs, build output, browser reports, coverage, crash dumps, and archived artwork out of commits. Reviewed `.env.example` files may document public build settings, but must not contain credentials. Browser builds may expose `VITE_` variables.

Exclude personal agent setup, downloaded skills, and session data through Git's local `info/exclude`. AnyFormat builds without them. Keep shared project instructions in `AGENTS.md`, and leave private notes and machine-specific file links out of public documentation.

Only assets used by the website belong in `public/`, because Vite copies that directory into deployments. Archive old designs in ignored `design-assets/` or `local-experiments/` directories. See [the audit summary](docs/audit-summary.md) for maintained safeguards and checks.

## Optional high-resolution checks

Run `npm run test:stress` to check monochrome and color tracing of a synthetic 4K image. These tests allocate larger buffers and run separately from the routine suite. They check tracing behavior; they do not measure performance or guarantee that every device can process the same inputs.
