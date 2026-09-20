import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';

export const DEFAULT_SITE_URL = 'http://localhost:5173/';

export function resolveSiteUrl(env = process.env) {
  if (env.VITE_SITE_URL) return env.VITE_SITE_URL;
  try {
    const loaded = loadEnv(process.env.NODE_ENV || 'production', process.cwd(), '');
    if (loaded.VITE_SITE_URL) return loaded.VITE_SITE_URL;
  } catch {
    // ignore
  }
  return DEFAULT_SITE_URL;
}

function normalizeSiteUrl(siteUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(siteUrl);
  } catch {
    throw new Error('VITE_SITE_URL must be an absolute HTTP(S) URL.');
  }

  if (
    !['http:', 'https:'].includes(parsedUrl.protocol)
    || parsedUrl.username
    || parsedUrl.password
    || parsedUrl.search
    || parsedUrl.hash
  ) {
    throw new Error('VITE_SITE_URL must be an HTTP(S) site URL without credentials, query, or fragment.');
  }

  parsedUrl.pathname = `${parsedUrl.pathname.replace(/\/+$/, '')}/`;
  return parsedUrl.toString();
}

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function createSiteDiscoveryFiles(siteUrl) {
  const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
  const sitemapUrl = new URL('sitemap.xml', normalizedSiteUrl).toString();

  return {
    'robots.txt': `User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`,
    'sitemap.xml': [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      `  <url><loc>${escapeXml(normalizedSiteUrl)}</loc></url>`,
      '</urlset>',
      '',
    ].join('\n'),
  };
}

export async function writeSiteDiscoveryFiles(
  outputDirectory,
  siteUrl = resolveSiteUrl(),
) {
  const files = createSiteDiscoveryFiles(siteUrl);
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all(
    Object.entries(files).map(([filename, contents]) =>
      writeFile(path.join(outputDirectory, filename), contents, 'utf8'),
    ),
  );
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  writeSiteDiscoveryFiles(path.resolve('dist')).catch((error) => {
    console.error(error instanceof Error ? error.message : 'Unable to generate site discovery files.');
    process.exitCode = 1;
  });
}
