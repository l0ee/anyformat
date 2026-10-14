import { ArrowRightLeft, Keyboard, Moon, PenTool, Sun } from 'lucide-react';

interface HeaderProps {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
  activeTab: 'single' | 'batch' | 'universal';
  setActiveTab: (value: 'single' | 'batch' | 'universal') => void;
  onOpenShortcuts?: () => void;
}

export function Header({ darkMode, setDarkMode, activeTab, setActiveTab, onOpenShortcuts }: HeaderProps) {
  return (
    <header className="workspace-header">
      <div className="workspace-header-inner">
        <div className="workspace-brand">
          <img src={`${import.meta.env.BASE_URL}logo-vibrant.png`} alt="" width={30} height={30} />
          <span>AnyFormat</span>
          <a className="workspace-author" href="https://github.com/l0ee/anyformat" target="_blank" rel="noopener noreferrer">by l0ee</a>
        </div>
        <nav aria-label="Conversion modes" className="workspace-nav">
          <button type="button" aria-pressed={activeTab === 'universal'} onClick={() => setActiveTab('universal')}>
            <ArrowRightLeft aria-hidden="true" size={16} /> Convert files
          </button>
          <button type="button" aria-pressed={activeTab !== 'universal'} onClick={() => setActiveTab(activeTab === 'batch' ? 'batch' : 'single')}>
            <PenTool aria-hidden="true" size={16} /> Create SVG
          </button>
        </nav>
        <div className="workspace-header-actions">
          <a href="https://github.com/l0ee/anyformat" target="_blank" rel="noreferrer" aria-label="View AnyFormat on GitHub" title="Source on GitHub">
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
              <path d="M9 18c-4.51 2-5-2-7-2" />
            </svg>
          </a>
          <button type="button" onClick={onOpenShortcuts} aria-label="Keyboard shortcuts" title="Keyboard shortcuts"><Keyboard size={18} aria-hidden="true" /></button>
          <button type="button" onClick={() => setDarkMode(!darkMode)} aria-label="Toggle theme" title="Toggle theme">{darkMode ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}</button>
        </div>
      </div>
    </header>
  );
}

export default Header;
