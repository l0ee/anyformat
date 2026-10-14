interface HeroHeaderProps {
  activeTab?: 'single' | 'batch' | 'universal';
  compact?: boolean;
}

export function HeroHeader({ activeTab = 'universal', compact = false }: HeroHeaderProps) {
  const converting = activeTab === 'universal';
  return (
    <section className="hero-header workspace-intro" data-compact={compact} aria-labelledby="page-heading">
      <div>
        <p className="workspace-kicker"><span aria-hidden="true" />{converting ? 'EVERYDAY FILE TOOLS, RIGHT IN YOUR BROWSER' : 'A LITTLE MORE POSSIBILITY IN EVERY PIXEL'}</p>
        <h1 id="page-heading">{converting ? 'Convert files. Keep them private.' : 'Create a cleaner SVG.'}</h1>
        <p className="workspace-description">{converting ? 'The right format for whatever comes next. Convert images, export a PDF page, or create an SVG. Everything happens on your device.' : 'Turn your images into scalable graphics. Choose a style, fine-tune the detail, and compare your SVG with the original.'}</p>
      </div>
    </section>
  );
}

export default HeroHeader;
