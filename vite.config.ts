import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { PRODUCTION_CSP } from './config/security-policy.js';
import { pdfjsAssets } from './config/pdfjs-assets.js';

// https://vitejs.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const siteUrl = (env.VITE_SITE_URL || 'http://localhost:5173/').replace(/\/*$/, '/');

  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [
      react(),
      tailwindcss(),
      pdfjsAssets(),
      {
        name: 'replace-site-metadata',
        transformIndexHtml(html: string) {
          return {
            html: html.replaceAll('%SITE_URL%', siteUrl),
            // Development needs React refresh and Vite's websocket. Generate
            // the production policy rather than removing it with a regex.
            tags: command === 'build' ? [{
              tag: 'meta',
              attrs: { 'http-equiv': 'Content-Security-Policy', content: PRODUCTION_CSP },
              injectTo: 'head-prepend' as const,
            }] : [],
          };
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              // Keep PDF.js from absorbing Vite's eagerly imported preload helper.
              { name: 'vendor-pdfjs', test: 'node_modules/pdfjs-dist', includeDependenciesRecursively: false },
              { name: 'vendor-pdflib', test: 'node_modules/pdf-lib' },
              { name: 'vendor-jszip', test: 'node_modules/jszip' },
              { name: 'vendor-icons', test: 'node_modules/lucide-react' },
            ],
          },
        },
      },
    },
  };
});
