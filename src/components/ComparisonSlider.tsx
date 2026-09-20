import React, { useState, useRef, useCallback, useId, useMemo } from 'react';

interface ComparisonSliderProps {
  originalUrl: string;
  svgContent: string;
}

export const ComparisonSlider: React.FC<ComparisonSliderProps> = ({
  originalUrl,
  svgContent,
}) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLElement>(null);
  const sliderId = useId();

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    let percentage = (x / rect.width) * 100;
    if (percentage < 0) percentage = 0;
    if (percentage > 100) percentage = 100;
    setSliderPosition(percentage);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    handleMove(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 1 || e.pointerType === 'touch') {
      handleMove(e.clientX);
    }
  };

  const svgDataUrl = useMemo(() => {
    if (!svgContent) return '';
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
  }, [svgContent]);

  const roundedPosition = Math.round(sliderPosition);

  return (
    <figure
      aria-label="Original and vector image comparison"
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      className="relative w-full h-[400px] sm:h-[500px] rounded-2xl overflow-hidden select-none touch-pan-y bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:16px_16px] bg-neutral-950 border border-neutral-800 shadow-2xl flex items-center justify-center cursor-ew-resize"
    >
      {/* Original Image (Left Side) */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        {originalUrl && (
          <img
            src={originalUrl}
            alt="Original raster preview"
            className="max-w-full max-h-full object-contain pointer-events-none"
          />
        )}
        <span className="absolute top-4 left-4 bg-[#faf5ef]/95 dark:bg-slate-900/90 text-stone-900 dark:text-white border border-stone-300/80 dark:border-slate-800 rounded-2xl shadow-xl text-xs font-semibold uppercase tracking-widest px-3 py-1.5 backdrop-blur z-20">
          ORIGINAL RASTER
        </span>
      </div>

      {/* SVG Image (Right Side - Clipped) */}
      <div
        className="absolute inset-0 flex items-center justify-center p-4 overflow-hidden pointer-events-none"
        style={{ clipPath: `polygon(${sliderPosition}% 0, 100% 0, 100% 100%, ${sliderPosition}% 100%)` }}
      >
        {svgDataUrl && (
          <img
            src={svgDataUrl}
            alt="Vector SVG preview"
            className="max-w-full max-h-full object-contain pointer-events-none"
          />
        )}
        <span className="absolute top-4 right-4 bg-[#faf5ef]/95 dark:bg-slate-900/90 text-stone-900 dark:text-white border border-stone-300/80 dark:border-slate-800 rounded-2xl shadow-xl text-xs font-semibold uppercase tracking-widest px-3 py-1.5 backdrop-blur z-20">
          VECTOR SVG
        </span>
      </div>

      <label htmlFor={sliderId} className="sr-only">
        Comparison position
      </label>
      <input
        id={sliderId}
        type="range"
        min="0"
        max="100"
        step="1"
        value={roundedPosition}
        onChange={(event) => setSliderPosition(Number(event.target.value))}
        onPointerDown={(event) => event.stopPropagation()}
        aria-valuetext={`${roundedPosition}% original, ${100 - roundedPosition}% vector`}
        className="absolute z-30 bottom-4 left-4 right-4 w-[calc(100%-2rem)] h-8 accent-pink-500 cursor-ew-resize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 rounded-full"
      />

      {/* Slider Line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-neutral-300 cursor-ew-resize z-10 transition-[left] duration-75 motion-reduce:transition-none"
        style={{ left: `${sliderPosition}%` }}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-[#faf5ef] shadow-xl flex items-center justify-center text-stone-800 border border-stone-300">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8M8 12h8M8 17h8" />
          </svg>
        </div>
      </div>
    </figure>
  );
};
