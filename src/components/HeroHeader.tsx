import React from 'react';
import { VectorBackground } from './VectorBackground';

interface HeroHeaderProps {
  activeTab?: 'single' | 'batch' | 'universal';
}

export const HeroHeader: React.FC<HeroHeaderProps> = ({ activeTab = 'universal' }) => {
  const title = activeTab === 'universal'
    ? 'Universal File Converter'
    : activeTab === 'batch'
    ? 'Batch Vector Studio'
    : 'Precision Vector Studio';

  const description = activeTab === 'universal'
    ? 'Convert images, vector graphics, and documents directly in your browser — private, fast, and local with zero server uploads.'
    : activeTab === 'batch'
    ? 'Apply uniform vectorization parameters across multiple raster files simultaneously, then export optimized SVG archives.'
    : 'Trace bitmap images into mathematical Bézier vector paths with real-time curve optimization, speckle suppression, and color palette controls.';

  return (
    <section className="relative" aria-labelledby="page-heading">
      {/* Dynamic Vector Constellation & Curves Background */}
      <VectorBackground />

      {/* Hero Header Content */}
      <div className="relative z-10 max-w-4xl mx-auto text-center space-y-3.5 my-4 sm:my-6">
        <h1 id="page-heading" className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-rose-700 via-pink-600 to-rose-600 dark:from-rose-400 dark:via-pink-300 dark:to-rose-200 drop-shadow-sm leading-tight transition-all duration-300">
          {title}
        </h1>
        <p className="max-w-3xl mx-auto text-sm sm:text-base font-medium leading-relaxed text-stone-700 dark:text-slate-200">
          {description}
        </p>
      </div>
    </section>
  );
};

export default HeroHeader;
