import { useState } from 'react';
import { Pause, Play } from 'lucide-react';

/** A small, self-contained illustration of pixels becoming a vector curve. */
export function ConversionMotionGraphic() {
  const [paused, setPaused] = useState(false);
  return (
    <div className="conversion-motion" data-paused={paused}>
      <svg viewBox="0 0 260 88" width="260" height="88" aria-hidden="true" className="conversion-motion-art">
        <rect x="7" y="12" width="64" height="64" rx="14" className="motion-card" />
        <g className="motion-pixels">
          <rect x="20" y="25" width="12" height="12" rx="3" fill="#fda4af" />
          <rect x="36" y="25" width="12" height="12" rx="3" fill="#fb7185" />
          <rect x="52" y="25" width="8" height="12" rx="3" fill="#fecdd3" />
          <rect x="20" y="41" width="12" height="12" rx="3" fill="#fecdd3" />
          <rect x="36" y="41" width="12" height="12" rx="3" fill="#e11d48" />
          <rect x="52" y="41" width="8" height="12" rx="3" fill="#fb7185" />
          <rect x="20" y="57" width="12" height="7" rx="3" fill="#fb7185" />
          <rect x="36" y="57" width="12" height="7" rx="3" fill="#fecdd3" />
        </g>
        <path d="M83 44H157" className="motion-route" />
        <path d="m151 39 6 5-6 5" className="motion-route" />
        <g className="motion-traveler"><rect x="85" y="39" width="10" height="10" rx="3" fill="#fb7185" /></g>
        <g className="motion-traveler motion-traveler-second"><rect x="85" y="41" width="6" height="6" rx="2" fill="#e11d48" /></g>
        <rect x="173" y="12" width="76" height="64" rx="14" className="motion-card" />
        <path d="M185 59C197 59 193 28 211 28S225 59 237 59" pathLength="100" className="motion-curve" />
        <g className="motion-handles">
          <path d="M185 59V28H211H237V59" className="motion-guide" />
          <circle cx="185" cy="59" r="3.5" className="motion-node" />
          <circle cx="211" cy="28" r="3.5" className="motion-node" />
          <circle cx="237" cy="59" r="3.5" className="motion-node" />
          <circle cx="185" cy="28" r="2" fill="#fb7185" />
          <circle cx="237" cy="28" r="2" fill="#fb7185" />
        </g>
      </svg>
      <button type="button" className="motion-graphic-toggle" aria-label={paused ? 'Resume illustration animation' : 'Pause illustration animation'} aria-pressed={paused} onClick={() => setPaused((value) => !value)}>
        {paused ? <Play size={12} aria-hidden="true" /> : <Pause size={12} aria-hidden="true" />}
      </button>
    </div>
  );
}
