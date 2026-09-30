import React from 'react';

interface HeroHeaderProps {
  activeTab?: 'single' | 'batch' | 'universal';
  compact?: boolean;
}

export const HeroHeader: React.FC<HeroHeaderProps> = ({ activeTab = 'universal', compact = false }) => {
  const title = activeTab === 'universal'
    ? 'Universal File Converter'
    : activeTab === 'batch'
    ? 'Batch Vector Studio'
    : 'Precision Vector Studio';

  const description = activeTab === 'universal'
    ? 'Convert images, SVG files, and PDF pages in your browser. Preview your results and download your files without uploading them to a server.'
    : activeTab === 'batch'
    ? 'Turn several images into SVG graphics using the same settings, then download the completed files together in a ZIP.'
    : 'Turn a picture into an SVG graphic that scales clearly. Adjust colors and detail, compare the result, and download your finished design.';

  return (
    <section className="hero-header relative" data-compact={compact} aria-labelledby="page-heading">
      {/* Hero Header Content */}
      <div className="relative z-10 max-w-4xl mx-auto text-center space-y-5">
        {!compact && <div className="studio-eyebrow"><span aria-hidden="true">✦</span> A LITTLE MAGIC. ALL YOURS.</div>}
        <h1 id="page-heading" className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-stone-900 dark:text-rose-50 leading-tight">
          {title}
        </h1>
        {!compact && <p className="max-w-3xl mx-auto text-sm sm:text-base font-medium leading-relaxed text-stone-700 dark:text-slate-200">
          {description}
        </p>}
        {!compact && <ol className="studio-steps" aria-label="Conversion steps">
          <li><span>01</span> {activeTab === 'single' ? 'Upload' : 'Add files'}</li>
          <li><span>02</span> {activeTab === 'universal' ? 'Choose format' : 'Refine'}</li>
          <li><span>03</span> Export</li>
        </ol>}
      </div>
    </section>
  );
};

export default HeroHeader;
