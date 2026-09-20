import React, { useId, useState } from 'react';
import { getFileExtension, isSupportedSourceExtension } from '../../engine/universal/types';

interface UniversalDropzoneProps {
  onFilesAdded: (files: File[]) => void;
}

export const UniversalDropzone: React.FC<UniversalDropzoneProps> = ({ onFilesAdded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const inputId = useId();
  const descriptionId = useId();
  const errorId = useId();

  const submitSupportedFiles = (files: File[]) => {
    const supported = files.filter((file) => {
      return isSupportedSourceExtension(getFileExtension(file.name));
    });
    const rejected = files.filter((file) => !supported.includes(file));

    setError(
      rejected.length > 0
        ? `${rejected.length} unsupported file${rejected.length === 1 ? '' : 's'} rejected: ${rejected.map((file) => file.name).join(', ')}`
        : ''
    );
    if (supported.length > 0) onFilesAdded(supported);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      submitSupportedFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      submitSupportedFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  return (
    <div className="relative max-w-3xl mx-auto my-6 font-['Plus_Jakarta_Sans',sans-serif]">
      <input
        id={inputId}
        type="file"
        onChange={handleInputChange}
        multiple
        accept=".png,.jpg,.jpeg,.webp,.bmp,.svg,.pdf,image/png,image/jpeg,image/webp,image/bmp,image/svg+xml,application/pdf"
        aria-describedby={`${descriptionId}${error ? ` ${errorId}` : ''}`}
        className="peer sr-only"
      />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative group rounded-[2.5rem] p-4 sm:p-6 transition-all duration-500 motion-reduce:transition-none motion-reduce:transform-none shadow-2xl bg-gradient-to-br from-[#f8ebe2]/90 via-[#fdede6]/80 to-[#f5e4da]/90 dark:from-pink-950/40 dark:via-rose-900/35 dark:to-pink-900/45 border border-[#e8cfc2]/80 dark:border-pink-500/30 backdrop-blur-md overflow-hidden peer-focus-visible:ring-4 peer-focus-visible:ring-pink-500 peer-focus-visible:ring-offset-2 dark:peer-focus-visible:ring-offset-slate-950 ${
          isDragging ? 'scale-[1.02] ring-4 ring-pink-400/80 shadow-pink-400/50' : 'hover:scale-[1.01] hover:shadow-2xl hover:border-pink-300/80'
        }`}
      >
        <div className="text-center mb-4 relative z-10">
          <span className="inline-block px-5 py-1.5 rounded-full text-xs sm:text-sm font-extrabold uppercase tracking-widest text-rose-950 dark:text-pink-100 bg-[#fdfaf6]/95 dark:bg-slate-900/80 border border-[#e8cfc2]/70 dark:border-pink-800/50 backdrop-blur-md shadow-md">
            UNIVERSAL FILE CONVERTER (IMAGE, SVG &amp; PDF)
          </span>
        </div>

        <label
          htmlFor={inputId}
          className="relative z-10 block cursor-pointer bg-[#faf5ef]/70 dark:bg-slate-900/40 backdrop-blur-sm rounded-[2rem] border-2 border-dashed border-pink-300/80 dark:border-pink-500/40 p-8 sm:p-12 text-center transition-all motion-reduce:transition-none group-hover:border-pink-400 shadow-inner"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-5 rounded-2xl bg-[#fdfaf6]/90 dark:bg-slate-800/70 backdrop-blur-md border border-[#e8cfc2]/80 dark:border-pink-700/50 shadow-md flex items-center justify-center group-hover:scale-110 group-hover:-translate-y-1.5 transition-all duration-300 motion-reduce:transition-none motion-reduce:transform-none">
            <svg
              className="w-8 h-8 sm:w-10 sm:h-10 text-pink-500 dark:text-pink-400 transition-transform duration-500 motion-reduce:transition-none motion-reduce:transform-none group-hover:rotate-12 group-hover:scale-110"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
          </div>

          <h3 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white tracking-tight mb-2">
            Choose or drag files here
          </h3>

          <p id={descriptionId} className="text-xs sm:text-sm font-semibold text-stone-600 dark:text-slate-200 mb-6">
            PNG, JPEG, WebP, BMP, SVG, and PDF input (up to 100 MB each)
          </p>

          <span
            aria-hidden="true"
            className="inline-flex min-h-11 items-center gap-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white font-bold text-sm sm:text-base px-8 py-3.5 rounded-full shadow-lg shadow-pink-500/25 group-hover:shadow-pink-500/40 group-hover:scale-105 transition-all duration-300 motion-reduce:transition-none motion-reduce:transform-none"
          >
            <span>Choose Files</span>
            <svg className="w-4 h-4 transition-transform motion-reduce:transition-none motion-reduce:transform-none group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </span>
        </label>
      </div>

      {/* Popular Conversion Pairs */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-stone-600 dark:text-slate-400">
        <span className="font-semibold text-stone-700 dark:text-slate-300">Popular:</span>
        <span className="rounded-lg border border-stone-300/80 bg-[#faf5ef] px-2.5 py-1 text-stone-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">PNG to SVG</span>
        <span className="rounded-lg border border-stone-300/80 bg-[#faf5ef] px-2.5 py-1 text-stone-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">PDF to PNG</span>
        <span className="rounded-lg border border-stone-300/80 bg-[#faf5ef] px-2.5 py-1 text-stone-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">WebP to PNG</span>
        <span className="rounded-lg border border-stone-300/80 bg-[#faf5ef] px-2.5 py-1 text-stone-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">SVG to PDF</span>
        <span className="rounded-lg border border-stone-300/80 bg-[#faf5ef] px-2.5 py-1 text-stone-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">JPEG to WebP</span>
      </div>

      {error && (
        <p id={errorId} role="alert" className="mt-3 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200">
          {error}
        </p>
      )}
    </div>
  );
};
