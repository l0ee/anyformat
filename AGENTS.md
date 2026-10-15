# AGENTS.md

## Commands
- **Development**: `npm run dev`
- **Validation suite**: `npm run typecheck && npm run lint && npm test`
- **Local-only file guard**: `node scripts/check-local-only.js` (no dependencies required)
- **Playwright E2E**: `npx playwright test --project=chromium`; WebKit: `npx playwright test --project=webkit` *(Nobara/Fedora setup: `docs/webkit-on-fedora.md`)*
- **Production server build & start**: `npm run build && npm start`

## Architecture Summary
- **Stack**: React 19 + Vite 8 + Tailwind CSS 4 (Vite plugin) + TypeScript
- **Processing**: 100% browser-side processing (no upload backend)
- **Format Support**: Single source of truth at `src/engine/universal/types.ts`
- **Worker Tracing**: `src/workers/traceWorker.ts` and `traceWorkerClient.ts`
- **Production Server**: `start-server.js` with SPA fallback, CSP, and compression
- **Assets**: `public/` for web deployment (`design-assets/` ignored)

## Rules
- Maintain 100% client-side execution for image processing and conversions.
- Always consult `src/engine/universal/types.ts` for supported formats and capabilities.
- Keep output concise, structured, and free of filler or generic advice.

## Local-only paths
Keep these repository-root paths ignored. Never stage, force-add, commit, or copy them into deployment assets:
- `project-notes/`
- `docs/superpowers/`
- `src/test/`
- `test/start-server.test.js` (superseded by `tests/server/start-server.test.js`)
- `src/engine/testEngine.ts`
- `src/utils/themeHelper.ts`
- `src/components/HoverBackground.tsx` and `src/components/HoverBackground.test.tsx`
- `src/components/VectorBackground.tsx` and `src/components/VectorBackground.test.tsx`
- `src/components/common/Tooltip.tsx`
- `public/background.mp4`
- `postcss.config.js`
- `Audit Prompt`

Do not publish private note contents or local filesystem paths in public files or GitHub text.
Keep real `.env` and `.env.*` files untracked at any depth. Only reviewed `.env.example` and `.env.*.example` files may be committed.
`test/fixtures/quadrantImage.ts` is shared test source and must stay tracked. The `test/` directory is not local-only. Keep the existing `.vscode/extensions.json` exception.
Run the local-only file guard before committing. It checks tracked paths without reading file contents.
