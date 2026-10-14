import { ArrowRight, ArrowRightLeft, Layers, PenTool, ShieldCheck } from 'lucide-react';

interface LandingFeaturesProps {
  onSelectMode: (mode: 'single' | 'batch' | 'universal') => void;
}

export function LandingFeatures({ onSelectMode }: LandingFeaturesProps) {
  return (
    <section className="landing-features" aria-labelledby="features-heading">
      <div className="landing-section-heading">
        <div>
          <p className="workspace-kicker">ONE TOOL, A FEW LESS STEPS</p>
          <h2 id="features-heading">Make your files work for you.</h2>
        </div>
        <p>From a quick format change to a new set of graphics.</p>
      </div>
      <section className="landing-feature-grid" aria-label="Converter Features">
        <article className="landing-feature-card" data-tone="rose">
          <span className="landing-feature-icon"><ArrowRightLeft size={23} aria-hidden="true" /></span>
          <h3>The format you need</h3>
          <p>Change image formats, resize your export, or turn a selected PDF page into an image.</p>
          <button type="button" onClick={() => onSelectMode('universal')}>Open converter <ArrowRight size={16} aria-hidden="true" /></button>
        </article>
        <article className="landing-feature-card" data-tone="violet">
          <span className="landing-feature-icon"><PenTool size={23} aria-hidden="true" /></span>
          <h3>Pixels into possibilities</h3>
          <p>Trace an image into SVG. Refine the colors and curves, then compare it with the original.</p>
          <button type="button" onClick={() => onSelectMode('single')}>Open Vector Studio <ArrowRight size={16} aria-hidden="true" /></button>
        </article>
        <article className="landing-feature-card" data-tone="teal">
          <span className="landing-feature-icon"><Layers size={23} aria-hidden="true" /></span>
          <h3>A whole batch, sorted</h3>
          <p>Apply one tracing style to multiple images and download your completed SVGs in a ZIP.</p>
          <button type="button" onClick={() => onSelectMode('batch')}>Try batch tracing <ArrowRight size={16} aria-hidden="true" /></button>
        </article>
      </section>
      <div className="landing-privacy-note">
        <span className="landing-privacy-icon"><ShieldCheck size={22} aria-hidden="true" /></span>
        <div><h3>Your files are yours.</h3><p>Conversion runs in your browser. Your images and documents are never uploaded to a conversion server.</p></div>
        <span className="landing-local-label">100% local processing</span>
      </div>
    </section>
  );
}
