import React, { useId, useState } from 'react';

interface DropzoneProps {
  onFileSelect: (files: FileList | File[]) => void;
  multiple?: boolean;
  disabled?: boolean;
}

export const Dropzone: React.FC<DropzoneProps> = ({ onFileSelect, multiple = false, disabled = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputId = useId();
  const descriptionId = useId();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
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
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <div className={`relative max-w-3xl mx-auto my-8 font-['Plus_Jakarta_Sans',sans-serif] ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
      {/* Hidden File Input */}
      <input
        id={inputId}
        type="file"
        onChange={handleInputChange}
        accept="image/png, image/jpeg, image/webp, image/bmp, image/gif"
        multiple={multiple}
        disabled={disabled}
        aria-describedby={descriptionId}
        className="peer sr-only"
      />

      {/* Transparent Sand & Desert Rose Envelope Container */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative group rounded-[2.5rem] p-4 sm:p-6 transition-all duration-500 motion-reduce:transition-none motion-reduce:transform-none shadow-2xl bg-gradient-to-br from-[#f8ebe2]/90 via-[#fdede6]/80 to-[#f5e4da]/90 dark:from-pink-950/40 dark:via-rose-900/35 dark:to-pink-900/45 border border-[#e8cfc2]/80 dark:border-pink-500/30 backdrop-blur-md overflow-hidden peer-focus-visible:ring-4 peer-focus-visible:ring-pink-500 peer-focus-visible:ring-offset-2 dark:peer-focus-visible:ring-offset-slate-950 ${
          isDragging ? 'scale-[1.02] ring-4 ring-pink-400/80 shadow-pink-400/50' : 'hover:scale-[1.01] hover:shadow-2xl hover:border-pink-300/80'
        }`}
      >
        {/* Bottom Curved Envelope Flap Shape Overlay */}
        <div className="absolute inset-x-0 bottom-0 pointer-events-none opacity-30">
          <svg className="w-full h-24 sm:h-32 text-pink-200 dark:text-pink-900 fill-current" viewBox="0 0 1440 320" preserveAspectRatio="none">
            <path d="M0,128L720,288L1440,128L1440,320L0,320Z" />
          </svg>
        </div>

        {/* Inner Dashed Box with Translucent Warm Sand Background */}
        <label
          htmlFor={inputId}
          className="relative z-10 block cursor-pointer bg-[#faf5ef]/70 dark:bg-slate-900/40 backdrop-blur-sm rounded-[2rem] border-2 border-dashed border-pink-300/80 dark:border-pink-500/40 p-8 sm:p-12 text-center transition-all motion-reduce:transition-none group-hover:border-pink-400 shadow-inner"
        >
          {/* Animated Cloud Icon Box */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-5 rounded-2xl bg-[#fdfaf6]/90 dark:bg-slate-800/70 backdrop-blur-md border border-[#e8cfc2]/80 dark:border-pink-700/50 shadow-md flex items-center justify-center group-hover:scale-110 group-hover:-translate-y-1.5 transition-all duration-300 motion-reduce:transition-none motion-reduce:transform-none">
            <svg
              className="w-8 h-8 sm:w-10 sm:h-10 text-pink-500 dark:text-pink-400 transition-transform duration-500 motion-reduce:transition-none motion-reduce:transform-none group-hover:rotate-6 group-hover:scale-110"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>

          {/* Heading */}
          <h3 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white tracking-tight mb-2">
            Drop your images here
          </h3>

          {/* Subtext */}
          <p id={descriptionId} className="text-xs sm:text-sm font-semibold text-stone-600 dark:text-slate-200 mb-6">
            PNG, JPG, WEBP, BMP, or GIF (up to 100 MB each)
          </p>

          {/* Action Button */}
          <span
            aria-hidden="true"
            className="inline-flex min-h-11 items-center gap-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white font-bold text-sm sm:text-base px-8 py-3.5 rounded-full shadow-lg shadow-pink-500/25 group-hover:shadow-pink-500/40 group-hover:scale-105 transition-all duration-300 motion-reduce:transition-none motion-reduce:transform-none"
          >
            <span>{multiple ? 'Browse Images' : 'Browse Image'}</span>
            <svg className="w-4 h-4 transition-transform motion-reduce:transition-none motion-reduce:transform-none group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </span>

          <p className="text-xs text-stone-500 dark:text-slate-400 mt-2">
            Or paste an image with Ctrl+V / ⌘V
          </p>
        </label>
      </div>
    </div>
  );
};

export default Dropzone;
