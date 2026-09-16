import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const siteUrl = (env.VITE_SITE_URL || 'http://localhost:5173/').replace(/\/*$/, '/');

  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [
      react(),
      {
        name: 'replace-site-metadata',
        transformIndexHtml(html: string) {
          return html.replaceAll('%SITE_URL%', siteUrl);
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
