import React from 'react';

const logoImg = `${import.meta.env.BASE_URL}logo-vibrant.png`;

interface HeaderProps {
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  activeTab: 'single' | 'batch' | 'universal';
  setActiveTab: (tab: 'single' | 'batch' | 'universal') => void;
}

export const Header: React.FC<HeaderProps> = ({
  darkMode,
  setDarkMode,
  activeTab,
  setActiveTab,
}) => {
  return (
    <header className="sticky top-4 z-50 max-w-6xl mx-auto px-4 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="bg-white/80 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-white rounded-full shadow-xl px-6 py-2.5 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-2.5 group">
          <img
            src={logoImg}
            alt="SVG Converter & Vectorizer"
            className="h-9 w-auto object-contain transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 group-hover:drop-shadow-[0_0_12px_rgba(244,63,94,0.6)]"
            decoding="async"
          />
          <span className="hidden lg:inline text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">
            SVG Converter &amp; Vectorizer
          </span>
          <a
            href="https://github.com/l0ee/svg-converter-and-universal-converter"
            target="_blank"
            rel="noreferrer"
            className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/20 text-pink-600 dark:text-pink-300 border border-pink-500/30 uppercase tracking-wider transition-all duration-300 group-hover:border-pink-400 group-hover:shadow-pink-500/20 shadow-sm"
            aria-label="View SVG Converter & Vectorizer on GitHub"
          >
            Open Source
          </a>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-tight group-hover:text-pink-500 transition-colors">by l0ee</span>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-3">
          {/* Mode switcher pills */}
          <nav aria-label="Conversion modes" className="mode-switcher bg-slate-100 dark:bg-slate-800 p-1 rounded-full flex items-center text-sm font-semibold">
            <button
              onClick={() => setActiveTab('single')}
              aria-pressed={activeTab === 'single'}
              className={`px-4 py-2 rounded-full transition-all ${
                activeTab === 'single'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              SVG Vectorizer
            </button>
            <button
              onClick={() => setActiveTab('batch')}
              aria-pressed={activeTab === 'batch'}
              className={`px-4 py-2 rounded-full transition-all ${
                activeTab === 'batch'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              SVG Batch
            </button>
            <button
              onClick={() => setActiveTab('universal')}
              aria-pressed={activeTab === 'universal'}
              className={`px-4 py-2 rounded-full transition-all ${
                activeTab === 'universal'
                  ? 'bg-pink-600 text-white shadow-sm font-extrabold'
                  : 'text-pink-600 dark:text-pink-400 hover:text-pink-700 font-bold'
              }`}
            >
              Format Converter
            </button>
          </nav>

          {/* Sun/Moon Light-Dark Mode Toggle button */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:scale-110 active:scale-95 transition-all duration-300 shadow-sm hover:shadow-md"
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {darkMode ? (
              <svg className="w-4 h-4 text-amber-400 transition-transform duration-500 hover:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-slate-700 transition-transform duration-500 hover:-rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
