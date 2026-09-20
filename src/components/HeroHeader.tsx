import React from 'react';
import { VectorBackground } from './VectorBackground';

interface HeroHeaderProps {
  activeTab?: 'single' | 'batch' | 'universal';
}

export const HeroHeader: React.FC<HeroHeaderProps> = ({ activeTab = 'single' }) => {
  const description = activeTab === 'universal'
    ? 'Convert PNG, JPEG, WebP, BMP, SVG, and PDF files directly in your browser with zero server uploads.'
    : activeTab === 'batch'
    ? 'Apply shared tracing settings to multiple raster images, then download the completed SVG files together in a ZIP archive.'
    : 'Trace PNG, JPEG, WebP, BMP, or GIF images into monochrome or layered-color SVG paths, then preview, refine, and export the result.';

  return (
    <section className="relative" aria-labelledby="page-heading">
      {/* Dynamic Vector Constellation & Curves Background */}
      <VectorBackground />

      {/* Hero Header Content */}
      <div className="relative z-10 max-w-4xl mx-auto text-center space-y-4 my-6">
        {/* Dynamic Title with Deeper Sakura Crimson Gradient & Dark Halo Shadow */}
        <h1 id="page-heading" className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-rose-600 via-pink-600 to-rose-500 dark:from-rose-400 dark:via-pink-300 dark:to-rose-200 drop-shadow-[0_2px_12px_rgba(15,23,42,0.65)] leading-tight transition-all duration-300">
          {activeTab === 'universal'
            ? 'Convert Supported Image, SVG, and PDF Formats'
            : activeTab === 'batch'
            ? 'Batch Convert Multiple Images to Vector SVG'
            : 'Trace Raster Images into Vector SVG'}
        </h1>
        <p className="max-w-3xl mx-auto text-sm sm:text-base font-medium leading-relaxed text-slate-700 dark:text-slate-200 drop-shadow-sm">
          {description}
        </p>
      </div>
    </section>
  );
};

export default HeroHeader;
