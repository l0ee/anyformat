import React, { useId, useState } from 'react';
import {
  getFileExtension,
  getUniversalInputAccept,
  getUniversalInputFormatLabels,
  getUniversalOutputFormatLabels,
  isSupportedSourceExtension,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_LABEL,
  SUPPORTED_FORMATS,
} from '../../engine/universal/types';

interface UniversalDropzoneProps {
  onFilesAdded: (files: File[]) => void;
  disabled?: boolean;
  compact?: boolean;
}

export const UniversalDropzone: React.FC<UniversalDropzoneProps> = ({ onFilesAdded, disabled = false, compact = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const inputId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const headingId = useId();
  const inputFormats = getUniversalInputFormatLabels();
  const outputFormats = getUniversalOutputFormatLabels();
  const formatMatrix = Object.values(SUPPORTED_FORMATS).filter(
    (format, index, formats) => formats.findIndex((candidate) => candidate.label === format.label) === index
  );

  const submitSupportedFiles = (files: File[]) => {
    if (disabled) return;
    const valid: File[] = [];
    const unsupportedExt: File[] = [];
    const oversized: File[] = [];

    files.forEach((file) => {
      const ext = getFileExtension(file.name);
      if (!isSupportedSourceExtension(ext)) {
        unsupportedExt.push(file);
      } else if (file.size > MAX_FILE_SIZE_BYTES) {
        oversized.push(file);
      } else {
        valid.push(file);
      }
    });

    const errorMsgs: string[] = [];
    if (unsupportedExt.length > 0) {
      errorMsgs.push(
        `${unsupportedExt.length} unsupported file${unsupportedExt.length === 1 ? '' : 's'} rejected: ${unsupportedExt.map((f) => f.name).join(', ')}`
      );
    }
    if (oversized.length > 0) {
      errorMsgs.push(
        `${oversized.length} file${oversized.length === 1 ? '' : 's'} exceeded the ${MAX_FILE_SIZE_LABEL} limit: ${oversized.map((f) => f.name).join(', ')}`
      );
    }

    setError(errorMsgs.join(' '));
    if (valid.length > 0) onFilesAdded(valid);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
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
      submitSupportedFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.target.files && e.target.files.length > 0) {
      submitSupportedFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  return (
    <div data-compact={compact} className="studio-upload relative max-w-3xl mx-auto my-6 font-['Plus_Jakarta_Sans',sans-serif]">
      <input
        id={inputId}
        type="file"
        disabled={disabled}
        onChange={handleInputChange}
        multiple
        accept={getUniversalInputAccept()}
        aria-label="Browse files for the format conversion queue"
        aria-describedby={`${descriptionId}${error ? ` ${errorId}` : ''}`}
        className="peer sr-only"
      />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="group"
        aria-labelledby={headingId}
        className={`relative group rounded-[2.5rem] p-4 sm:p-6 transition-all duration-500 motion-reduce:transition-none motion-reduce:transform-none shadow-2xl bg-gradient-to-br from-[#f8ebe2]/90 via-[#fdede6]/80 to-[#f5e4da]/90 dark:from-pink-950/40 dark:via-rose-900/35 dark:to-pink-900/45 border border-[#e8cfc2]/80 dark:border-pink-500/30 backdrop-blur-md overflow-hidden peer-focus-visible:ring-4 peer-focus-visible:ring-pink-500 peer-focus-visible:ring-offset-2 dark:peer-focus-visible:ring-offset-slate-950 ${
          isDragging ? 'scale-[1.02] ring-4 ring-pink-400/80 shadow-pink-400/50' : 'hover:scale-[1.01] hover:shadow-2xl hover:border-pink-300/80'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <div className="relative z-10 bg-[#faf5ef]/70 dark:bg-slate-900/40 backdrop-blur-sm rounded-[2rem] border-2 border-dashed border-pink-300/80 dark:border-pink-500/40 p-8 sm:p-12 text-center transition-all motion-reduce:transition-none group-hover:border-pink-400 shadow-inner">
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

          <h3 id={headingId} className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white tracking-tight mb-2">
            Drag files here or choose files
          </h3>

          <p id={descriptionId} className="text-xs sm:text-sm font-semibold text-stone-600 dark:text-slate-200 mb-6">
            Inputs: {inputFormats.join(', ')} · up to {MAX_FILE_SIZE_LABEL} per file
          </p>

          <label
            htmlFor={inputId}
            className="inline-flex min-h-11 items-center gap-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white font-bold text-sm sm:text-base px-8 py-3.5 rounded-full shadow-lg shadow-pink-500/25 group-hover:shadow-pink-500/40 group-hover:scale-105 transition-all duration-300 motion-reduce:transition-none motion-reduce:transform-none"
          >
            <span>{compact ? 'Add files' : 'Choose Files'}</span>
            <svg className="w-4 h-4 transition-transform motion-reduce:transition-none motion-reduce:transform-none group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </label>

          <p className="text-xs text-stone-500 dark:text-slate-400 mt-2">
            Or paste an image with Ctrl+V / ⌘V
          </p>
        </div>
      </div>

      <details className="mt-4 rounded-2xl border border-stone-200/90 bg-[#faf5ef]/80 px-4 py-3 text-xs text-stone-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
        <summary className="cursor-pointer font-bold text-stone-900 dark:text-white">Supported inputs and outputs</summary>
        <p className="mt-2 leading-relaxed">Outputs depend on the input: {outputFormats.join(', ')}.</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Supported conversion paths">
          {formatMatrix.map((format) => (
            <li key={format.ext} className="rounded-lg bg-white/70 px-3 py-2 dark:bg-slate-800/70">
              <span className="font-semibold">{format.label}</span>
              <span className="block mt-0.5">→ {format.canExportTo.map((target) => target.toUpperCase()).join(', ')}</span>
            </li>
          ))}
        </ul>
      </details>

      {error && (
        <p id={errorId} role="alert" className="mt-3 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200">
          {error}
        </p>
      )}
    </div>
  );
};
