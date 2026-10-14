# AGENTS.md

## Commands
- **Development**: `npm run dev`
- **Validation suite**: `npm run typecheck && npm run lint && npm test`
- **Playwright E2E**: `npx playwright test --project=chromium`; WebKit: `npx playwright test --project=webkit` *(Nobara/Fedora setup: `docs/webkit-on-fedora.md`)*
- **Production server build & start**: `npm run build && npm start`

## Architecture Summary
- **Stack**: React 18 + Vite 6 + Tailwind CSS 4 (Vite plugin) + TypeScript
- **Processing**: 100% browser-side processing (no upload backend)
- **Format Support**: Single source of truth at `src/engine/universal/types.ts`
- **Worker Tracing**: `src/workers/traceWorker.ts` and `traceWorkerClient.ts`
- **Production Server**: `start-server.js` with SPA fallback, CSP, and compression
- **Assets**: `public/` for web deployment (`design-assets/` ignored)

## Rules
- Maintain 100% client-side execution for image processing and conversions.
- Always consult `src/engine/universal/types.ts` for supported formats and capabilities.
- Keep output concise, structured, and free of filler or generic advice.
