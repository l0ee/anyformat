# Contributing

Thanks for contributing to SVG Converter & Vectorizer.

## Development flow

1. Fork or clone the repository.
2. Run `npm ci`.
3. Create a focused branch from `main`.
4. Make the change without committing `node_modules`, `dist`, or `design-assets`.
5. Run `npm run typecheck` and `npm run build`.
6. Test affected controls with a keyboard and at a narrow viewport.
7. Open a pull request describing the behavior change and validation performed.

Conversion-format claims must match `src/engine/universal/types.ts`. Do not advertise a decoder, encoder, upload limit, privacy guarantee, or third-party engine unless it is implemented and verified.

## Commit scope

Keep commits focused and use clear imperative subjects, for example `Fix universal target intersection` or `Improve batch queue status semantics`.
