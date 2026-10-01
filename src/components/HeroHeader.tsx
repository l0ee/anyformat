interface HeroHeaderProps {
  activeTab?: 'single' | 'batch' | 'universal';
  compact?: boolean;
}

export function HeroHeader({ activeTab = 'universal', compact = false }: HeroHeaderProps) {
  const converting = activeTab === 'universal';
  return (
    <section className="hero-header workspace-intro" data-compact={compact} aria-labelledby="page-heading">
      <div>
        <p className="workspace-kicker">{converting ? 'EVERYDAY FILE TOOLS' : 'IMAGES INTO SCALABLE GRAPHICS'}</p>
        <h1 id="page-heading">{converting ? 'Convert files. Keep them private.' : 'Create a cleaner SVG.'}</h1>
        <p className="workspace-description">{converting ? 'Change image formats or export a PDF page. Everything happens on your device.' : 'Add one image or several. Choose a style, adjust the detail, and compare the result.'}</p>
      </div>
      <span className="workspace-local-badge"><span aria-hidden="true">●</span> No uploads. No account.</span>
    </section>
  );
}

export default HeroHeader;
