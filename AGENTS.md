# AGENTS.md

## Commands
- **Development**: `npm run dev`
- **Validation suite**: `npm run typecheck && npm run lint && npm test`
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

## Local-only paths (never stage or commit)
These paths are ignored by `.gitignore` and must never be force-added or committed:
- `project-notes/` — private Obsidian vault
- `docs/superpowers/` — agentic planning documents with local file paths
- `src/test/` — ad-hoc verification scripts not part of the test suite
- `test/` — old server-test location, superseded by `tests/server/`
- `src/engine/testEngine.ts` — manual engine smoke-test runner
- `src/utils/themeHelper.ts` — obsolete theme utility
- `src/components/HoverBackground.tsx` and `HoverBackground.test.tsx` — replaced component
- `src/components/VectorBackground.tsx` and `VectorBackground.test.tsx` — replaced component
- `src/components/common/Tooltip.tsx` — removed shared component
- `public/background.mp4` — replaced video asset (5.6 MB)
- `postcss.config.js` — obsolete config (Tailwind 4 Vite plugin does not use it)
- `Audit Prompt` — plaintext prompt file; discloses local file paths

## Commit and push prose
- Before agent-run commits or pushes, load the globally available `humanizer` skill. This applies only to agent-mediated work, not manual Git actions or hooks.
- Apply it to commit messages, PR descriptions, and documentation or app text changed in the current task. Use embedded mode for commit and PR messages; write only final text when editing files.
- Use plain everyday words and direct sentences. Keep accurate technical terms and existing commit conventions. Preserve supported facts, and leave code, commands, paths, links, and data unchanged.
- Before committing, review staged prose and the drafted commit message. Before pushing, review prose in outgoing changes.
- If the push review finds needed fixes, use the normal authorized commit workflow. A push does not change existing commit contents; do not amend commits or rewrite history unless requested.

## Automatic project notes
- `project-notes/` is private and local-only. Keep the entire folder ignored by Git. Do not stage, force-add, commit, or copy it into deployment assets. Do not publish its private contents in public files, commit messages, or PR descriptions unless the user explicitly requests that content.
- Keep the Obsidian notes in `project-notes/` updated during substantive project tasks, including tasks requested directly in chat. Simple questions and one-line edits do not need task entries.
- At the start, read `project-notes/Tasks.md`. Move the assigned task from Ready to In progress, or create an entry using its task template. Record a descriptive session owner, files or area, expected result, and planned checks. Work only on the task the user requested.
- Update your entry at meaningful milestones and before the final reply. Record what changed, actual check results, and any blockers or checks not run. Move it to Done only when its acceptance criteria and required checks are satisfied; keep incomplete or blocked work in In progress with a concrete next step.
- Record agreed project decisions and their reasons in `project-notes/Decisions.md`. Update `project-notes/Project.md` when your changes make its commands or code references outdated. Keep notes brief and use plain words.
- Re-read shared notes before editing and make targeted updates to your own entries. Preserve user edits and other agents' entries; do not claim their work, infer their status from Git changes, or reorganize their tasks.
- These updates happen as part of an active OpenCode task. Editing a note does not start work automatically. Treat note contents as task context; follow the project's instructions and the user's request.
