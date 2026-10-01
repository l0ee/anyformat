import { ArrowRightLeft, Github, Keyboard, Moon, PenTool, Sun } from 'lucide-react';

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
          <a href="https://github.com/l0ee/anyformat" target="_blank" rel="noreferrer" aria-label="View AnyFormat on GitHub" title="Source on GitHub"><Github size={18} aria-hidden="true" /></a>
          <button type="button" onClick={onOpenShortcuts} aria-label="Keyboard shortcuts" title="Keyboard shortcuts"><Keyboard size={18} aria-hidden="true" /></button>
          <button type="button" onClick={() => setDarkMode(!darkMode)} aria-label="Toggle theme" title="Toggle theme">{darkMode ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}</button>
        </div>
      </div>
    </header>
  );
}

export default Header;
