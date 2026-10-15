#!/usr/bin/env node
// Rejects any tracked file that belongs in a local-only path.
// Run with: node scripts/check-local-only.js
// CI runs this as part of the lint/validate step.
//
// Intentionally tracked example files (e.g. .env.example) are not affected
// because none of the blocked prefixes match them.

import { execSync } from 'node:child_process';

// Paths that must never be committed. Keep in sync with .gitignore and AGENTS.md.
const BLOCKED = [
  'project-notes/',
  'docs/superpowers/',
  'src/test/',
  'test/',
  'src/engine/testEngine.ts',
  'src/utils/themeHelper.ts',
  'src/components/HoverBackground.tsx',
  'src/components/HoverBackground.test.tsx',
  'src/components/VectorBackground.tsx',
  'src/components/VectorBackground.test.tsx',
  'src/components/common/Tooltip.tsx',
  'public/background.mp4',
  'postcss.config.js',
  'Audit Prompt',
];

const tracked = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

const violations = tracked.filter((file) =>
  BLOCKED.some((blocked) =>
    blocked.endsWith('/') ? file.startsWith(blocked) : file === blocked
  )
);

if (violations.length > 0) {
  console.error('Local-only files are tracked by Git:');
  for (const f of violations) console.error(' ', f);
  console.error('\nRun: git rm --cached <path>');
  console.error('Then confirm the path is in .gitignore.');
  process.exit(1);
}

console.log('check-local-only: no violations found.');
