# Contributing

Thanks for contributing to AnyFormat.

## Development flow

1. Fork or clone the repository.
2. Run `npm ci`.
3. Create a focused branch from `main`.
4. Make the change without committing `node_modules`, `dist`, or `design-assets`.
5. Run `npm run lint`, `npm run typecheck`, and `npm run build`.
6. Test affected controls with a keyboard and at a narrow viewport.
7. Open a pull request describing the behavior change and validation performed.

`main` is protected: changes should arrive through a pull request, and the `validate` GitHub Actions check must pass before merging. This repository is currently maintained by one owner, so a second approval is not required; the owner merges the pull request after reviewing the diff and checks. If collaborators are added, increase the required approval count to one.

Install Playwright browsers before running the end-to-end suite locally:

```bash
npx playwright install chromium firefox webkit
```

On Debian or Ubuntu, use `npx playwright install --with-deps chromium firefox webkit` when the host is missing browser system libraries.

Conversion-format claims must match `src/engine/universal/types.ts`. Do not advertise a decoder, encoder, upload limit, privacy guarantee, or third-party engine unless it is implemented and verified.

## Commit scope

Keep commits focused and use clear imperative subjects, for example `Fix universal target intersection` or `Improve batch queue status semantics`.
