import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';

const localOnlyDirectories = ['project-notes/', 'docs/superpowers/', 'src/test/'];
const localOnlyFiles = new Set([
  'test/start-server.test.js',
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
]);

const trackedPaths = execFileSync('git', ['ls-files', '-z'], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
}).split('\0').filter(Boolean);

const offendingPaths = trackedPaths.filter((filePath) => {
  const name = basename(filePath);
  const isEnvironmentFile = name === '.env' || name.startsWith('.env.');
  const isExample = name === '.env.example'
    || (name.startsWith('.env.') && name.endsWith('.example'));

  return localOnlyFiles.has(filePath)
    || localOnlyDirectories.some((directory) => filePath.startsWith(directory))
    || (isEnvironmentFile && !isExample);
});

if (offendingPaths.length > 0) {
  for (const filePath of offendingPaths) console.error(filePath);
  process.exitCode = 1;
}
