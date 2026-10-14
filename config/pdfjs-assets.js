import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// PDF.js resolves its codec files by name, so preserve names rather than
// emitting hashed individual assets. Copy from the installed dependency.
export function pdfjsAssets() {
  const require = createRequire(import.meta.url);
  const directory = path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'wasm');
  const names = readdirSync(directory);
  return {
    name: 'pdfjs-codec-assets',
    generateBundle() {
      for (const name of names) {
        this.emitFile({ type: 'asset', fileName: `pdfjs/wasm/${name}`, source: readFileSync(path.join(directory, name)) });
      }
    },
    configureServer(server) {
      const prefix = `${server.config.base}pdfjs/wasm/`;
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url || '/', 'http://localhost').pathname;
        if (!pathname.startsWith(prefix)) return next();
        const name = pathname.slice(prefix.length);
        if (!names.includes(name)) return next();
        response.setHeader('Content-Type', name.endsWith('.wasm') ? 'application/wasm' : name.endsWith('.js') ? 'text/javascript' : 'text/plain');
        response.end(readFileSync(path.join(directory, name)));
      });
    },
  };
}
