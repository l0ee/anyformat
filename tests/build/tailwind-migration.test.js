import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const tailwindRequire = createRequire(require.resolve('@tailwindcss/vite'));
const viteRequire = createRequire(require.resolve('vite'));
const { compile, optimize } = tailwindRequire('@tailwindcss/node');
const postcss = viteRequire('postcss');
const base = fileURLToPath(new URL('../../', import.meta.url));

async function compileUtilities(candidates, extraCss = '') {
  const compiler = await compile(`@import "./src/index.css";\n${extraCss}`, {
    base, onDependency() {},
  });
  return postcss.parse(optimize(compiler.build(candidates), { minify: false }).code);
}

function getRule(root, selector) {
  const rules = [];
  root.walkRules((rule) => { if (rule.selector === selector) rules.push(rule); });
  expect(rules, `Missing compiled selector: ${selector}`).toHaveLength(1);
  return rules[0];
}

function declarations(rule) {
  return Object.fromEntries(rule.nodes.filter((node) => node.type === 'decl').map((node) => [node.prop, node.value]));
}

describe('Tailwind 4 migration', () => {
  it('uses the matching Vite compiler and removes the vulnerable v3 dependency chain', () => {
    const version = require('tailwindcss/package.json').version;
    expect(version).toMatch(/^4\./);
    expect(tailwindRequire('../package.json').version).toBe(version);
    expect(createRequire(tailwindRequire.resolve('@tailwindcss/node'))('../package.json').version).toBe(version);
    for (const name of ['braces', 'micromatch', 'fast-glob', 'chokidar', 'postcss-nested', 'postcss-selector-parser', 'autoprefixer']) {
      expect(() => require.resolve(name)).toThrow();
    }
  });

  it('preserves responsive and class-based dark variants', async () => {
    const root = await compileUtilities(['sm:flex', 'dark:focus:ring-2', 'dark:lg:hover:text-white']);
    const flex = getRule(root, '.sm\\:flex');
    expect(declarations(flex).display).toBe('flex');
    expect(flex.parent.params).toBe('(min-width: 40rem)');
    expect(declarations(getRule(root, '.dark\\:focus\\:ring-2:where(.dark, .dark *):focus'))).toHaveProperty('--tw-ring-shadow');
    expect(declarations(getRule(root, '.dark\\:lg\\:hover\\:text-white:where(.dark, .dark *):hover')).color).toBe('var(--color-white)');
    const darkMedia = [];
    root.walkAtRules('media', (rule) => { if (rule.params.includes('prefers-color-scheme')) darkMedia.push(rule); });
    expect(darkMedia).toEqual([]);
  });

  it('compiles group and peer states without the legacy selector parser', async () => {
    const root = await compileUtilities(['group-hover:text-rose-500', 'peer-focus:opacity-100', 'peer-checked:translate-x-1']);
    const hover = getRule(root, '.group-hover\\:text-rose-500:is(:where(.group):hover *)');
    expect(declarations(hover).color).toBe('#f43f5e');
    expect(hover.parent.params).toBe('(hover: hover)');
    expect(declarations(getRule(root, '.peer-focus\\:opacity-100:is(:where(.peer):focus ~ *)')).opacity).toBe('1');
    expect(declarations(getRule(root, '.peer-checked\\:translate-x-1:is(:where(.peer):checked ~ *)'))).toHaveProperty('translate');
  });

  it('preserves arbitrary dimensions, child selectors and compound pseudos', async () => {
    const root = await compileUtilities(['w-[calc(100%-1rem)]', 'bg-[rgb(255,0,0)]', '[&>svg]:h-4', '[&:is(.a,.b)]:p-2']);
    expect(declarations(getRule(root, '.w-\\[calc\\(100\\%-1rem\\)\\]')).width).toBe('calc(100% - 1rem)');
    expect(declarations(getRule(root, '.bg-\\[rgb\\(255\\,0\\,0\\)\\]'))['background-color']).toBe('red');
    expect(declarations(getRule(root, '.\\[\\&\\>svg\\]\\:h-4 > svg')).height).toBe('calc(var(--spacing) * 4)');
    expect(declarations(getRule(root, '.\\[\\&\\:is\\(\\.a\\,\\.b\\)\\]\\:p-2:is(.a, .b)')).padding).toBe('calc(var(--spacing) * 2)');
  });

  it('retains sibling spacing and hidden-child behavior including responsive variants', async () => {
    const root = await compileUtilities(['space-y-4', 'sm:space-y-8', 'space-x-1']);
    expect(declarations(getRule(root, '.space-y-4 > :not(:last-child)'))['margin-block']).toBe('0');
    expect(declarations(getRule(root, '.space-y-4 > :not([hidden]) ~ :not([hidden])'))['margin-top']).toBe('calc(4 * var(--spacing) * (1 - var(--tw-space-y-reverse)))');
    const responsive = getRule(root, '.sm\\:space-y-8 > :not([hidden]) ~ :not([hidden])');
    expect(responsive.parent.params).toBe('(min-width: 40rem)');
    expect(declarations(responsive)['margin-top']).toContain('8 * var(--spacing)');
    expect(declarations(getRule(root, '.space-x-1 > :not([hidden]) ~ :not([hidden])'))['margin-left']).toBe('calc(1 * var(--spacing) * (1 - var(--tw-space-x-reverse)))');
  });

  it('preserves the UI palette, small scales and nested text line heights', async () => {
    const root = await compileUtilities(['text-rose-700', 'bg-slate-900', 'rounded-sm', 'shadow-sm', 'backdrop-blur-sm', 'text-xs']);
    expect(declarations(getRule(root, '.text-rose-700')).color).toBe('#be123c');
    expect(declarations(getRule(root, '.bg-slate-900'))['background-color']).toBe('#0f172a');
    const values = new Map();
    root.walkDecls((decl) => values.set(decl.prop, decl.value));
    expect(values.get('--radius-sm')).toBe('.125rem');
    expect(values.get('--blur-sm')).toBe('4px');
    expect(values.get('--text-xs--line-height')).toBe('1rem');
    expect(declarations(getRule(root, '.text-xs'))['line-height']).toBe('var(--tw-leading, var(--text-xs--line-height))');
    expect(declarations(getRule(root, '.shadow-sm'))['--tw-shadow']).toContain('0 1px 2px 0');
  });

  it('retains gradient aliases and expands @apply with registered theme values', async () => {
    const root = await compileUtilities(['bg-gradient-to-r', 'from-rose-600', 'to-pink-600'], '.applied:hover { @apply p-2 text-rose-600; }');
    expect(declarations(getRule(root, '.bg-gradient-to-r'))).toEqual({
      '--tw-gradient-position': 'to right',
      'background-image': 'linear-gradient(var(--tw-gradient-stops))',
    });
    expect(declarations(getRule(root, '.applied:hover'))).toEqual({ padding: 'calc(var(--spacing) * 2)', color: '#e11d48' });
    const remaining = [];
    root.walkAtRules('apply', (rule) => remaining.push(rule));
    expect(remaining).toEqual([]);
  });

  it('keeps workspace overrides above utility layers and preserves reduced-motion rules', async () => {
    const root = await compileUtilities(['rounded-xl', 'p-6', 'hover:scale-105', 'focus-visible:outline-hidden']);
    expect(declarations(getRule(root, '.app-main :is(button, select)'))['border-radius']).toBe('10px');
    expect(getRule(root, '.app-main :is(button, select)').parent.type).toBe('root');
    expect(declarations(getRule(root, '.app-main fieldset')).padding).toBe('20px');
    expect(declarations(getRule(root, '.app-main button:hover')).transform).toBe('scale3d(1, 1, 1)');
    const reducedMotion = [];
    root.walkAtRules('media', (rule) => { if (rule.params === '(prefers-reduced-motion: reduce)') reducedMotion.push(rule); });
    expect(reducedMotion).toHaveLength(1);
    expect(reducedMotion[0].toString()).toContain('animation: none !important');
    expect(root.toString()).toContain('.focus-visible\\:outline-hidden:focus-visible');
  });
});
