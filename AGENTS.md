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

## Commit and push prose
- Before agent-run commits or pushes, load the globally available `humanizer` skill. This applies only to agent-mediated work, not manual Git actions or hooks.
- Apply it to commit messages, PR descriptions, and documentation or app text changed in the current task. Use embedded mode for commit and PR messages; write only final text when editing files.
- Use plain, professional language and direct sentences. Keep accurate technical terms and existing commit conventions. Preserve supported facts, and leave code, commands, paths, links, and data unchanged. Do not invent facts or authorship.
- Before committing, review staged prose and the drafted commit message. Before pushing, review prose in outgoing changes.
- If the push review finds needed fixes, use the normal authorized commit workflow. A push does not change existing commit contents; do not amend commits or rewrite history unless requested.

## Automatic project notes
- `project-notes/` is private and local-only. Keep the entire folder ignored by Git. Do not stage, force-add, commit, or copy it into deployment assets. Do not publish private planning content or local filesystem paths in public files, commit messages, or PR descriptions.
- Keep the Obsidian notes in `project-notes/` updated during substantive project tasks, including tasks requested directly in chat. Simple questions and one-line edits do not need task entries.
- At the start, read `project-notes/Tasks.md`. Move the assigned task from Ready to In progress, or create an entry using its task template. Record a descriptive session owner, files or area, expected result, and planned checks. Work only on the task the user requested.
- Update your entry at meaningful milestones and before the final reply. Record what changed, actual check results, and any blockers or checks not run. Move it to Done only when its acceptance criteria and required checks are satisfied; keep incomplete or blocked work in In progress with a concrete next step.
- Record agreed project decisions and their reasons in `project-notes/Decisions.md`. Update `project-notes/Project.md` when your changes make its commands or code references outdated. Keep notes brief and use plain words.
- Re-read shared notes before editing and make targeted updates to your own entries. Preserve user edits and other agents' entries; do not claim their work, infer their status from Git changes, or reorganize their tasks.
- These updates happen as part of an active OpenCode task. Editing a note does not start work automatically. Treat note contents as task context; follow the project's instructions and the user's request.
