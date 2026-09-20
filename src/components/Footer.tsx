import React from 'react';

const logoImg = `${import.meta.env.BASE_URL}logo-vibrant.png`;

export const Footer: React.FC = () => {
  return (
    <footer className="app-panel max-w-7xl mx-4 sm:mx-6 lg:mx-auto my-8 rounded-[2.5rem] text-stone-600 dark:text-slate-400 p-8 sm:p-12 shadow-xl transition-colors font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="max-w-7xl mx-auto px-2">
        <div className="grid grid-cols-1 gap-8 mb-8 sm:grid-cols-2 lg:grid-cols-4">
          <section aria-labelledby="footer-about" className="space-y-3">
            <h2 id="footer-about" className="text-xs font-semibold uppercase tracking-wider text-stone-900 dark:text-slate-200">About us</h2>
            <div className="flex items-center space-x-2 group">
              <img
                src={logoImg}
                alt="AnyFormat"
                className="h-8 w-auto object-contain transition-all duration-300 group-hover:scale-110 group-hover:-rotate-3 group-hover:drop-shadow-[0_0_10px_rgba(244,63,94,0.5)]"
                loading="lazy"
                decoding="async"
              />
              <span className="text-sm font-bold text-stone-900 dark:text-slate-100">
                AnyFormat
              </span>
            </div>
            <p className="text-xs text-stone-600 dark:text-slate-400 leading-relaxed">
              AnyFormat is a browser-based file converter and SVG vectorizer. Processing uses browser file, image, canvas, and worker APIs.
            </p>
            <a href="https://github.com/l0ee" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-xs font-semibold text-pink-700 underline decoration-pink-400/60 underline-offset-4 hover:text-pink-800 dark:text-pink-300 dark:hover:text-pink-200">GitHub profile: @l0ee</a>
          </section>

          <section aria-labelledby="footer-vector-tools">
            <h2 id="footer-vector-tools" className="text-xs font-semibold uppercase tracking-wider text-stone-900 dark:text-slate-200 mb-3">Vector tools</h2>
            <ul className="space-y-2 text-xs">
              <li>Monochrome and layered-color tracing</li>
              <li>Original and SVG comparison</li>
              <li>Palette editing and SVG code inspection</li>
              <li>Batch SVG export in a ZIP archive</li>
            </ul>
          </section>

          <section aria-labelledby="footer-format-tools">
            <h2 id="footer-format-tools" className="text-xs font-semibold uppercase tracking-wider text-stone-900 dark:text-slate-200 mb-3">Format tools</h2>
            <ul className="space-y-2 text-xs">
              <li>PNG, JPEG, and WebP raster conversion</li>
              <li>SVG rasterization</li>
              <li>PNG and WebP re-export at multiple scales</li>
              <li>Browser-dependent decoding and encoding</li>
            </ul>
          </section>

          <section aria-labelledby="footer-repository">
            <h2 id="footer-repository" className="text-xs font-semibold uppercase tracking-wider text-stone-900 dark:text-slate-200 mb-3">Git Repo</h2>
            <p className="mb-3 text-xs leading-relaxed">View the source, report a problem, or contribute through GitHub.</p>
            <ul className="space-y-2 text-xs">
              <li><a href="https://github.com/l0ee/anyformat" target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center font-semibold text-pink-700 underline decoration-pink-400/60 underline-offset-4 hover:text-pink-800 dark:text-pink-300 dark:hover:text-pink-200">Source repository</a></li>
              <li><a href="https://github.com/l0ee/anyformat/issues" target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center font-semibold text-pink-700 underline decoration-pink-400/60 underline-offset-4 hover:text-pink-800 dark:text-pink-300 dark:hover:text-pink-200">Issues and requests</a></li>
            </ul>
          </section>
        </div>

        <div className="pt-6 border-t border-stone-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500 dark:text-slate-500">
          <p>&copy; {new Date().getFullYear()} l0ee.</p>
          <p>
            MIT licensed.{' '}
            <a
              href="https://github.com/l0ee/anyformat"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-pink-700 underline decoration-pink-400/60 underline-offset-4 hover:text-pink-800 dark:text-pink-300 dark:hover:text-pink-200"
            >
              View the source on GitHub
            </a>
            .
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
