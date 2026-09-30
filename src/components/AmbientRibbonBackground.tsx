import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

/** Three soft ribbons instead of a continuously simulated particle field. */
export function AmbientRibbonBackground() {
  const layerRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame: number | null = null;
    let x = 0;
    let y = 0;
    let cursorX = 0;
    let cursorY = 0;
    let panel: HTMLElement | null = null;
    let litPanel: HTMLElement | null = null;

    const clearPanel = () => {
      litPanel?.removeAttribute('data-hover-lit');
      litPanel = null;
    };

    const reset = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      layer.style.setProperty('--ribbon-x', '0px');
      layer.style.setProperty('--ribbon-y', '0px');
      layer.dataset.hover = 'false';
      panel = null;
      clearPanel();
    };
    const sync = () => {
      layer.dataset.hidden = String(document.hidden);
      if (paused || motion.matches || document.hidden) reset();
    };
    const move = (event: PointerEvent) => {
      if (paused || motion.matches || document.hidden || event.pointerType === 'touch') return;
      cursorX = event.clientX;
      cursorY = event.clientY;
      panel = event.target instanceof Element
        ? event.target.closest<HTMLElement>('.app-panel, .hover-surface, .studio-upload [role="group"]')
        : null;
      x = (Math.min(1, Math.max(0, event.clientX / window.innerWidth)) - 0.5) * 24;
      y = (Math.min(1, Math.max(0, event.clientY / window.innerHeight)) - 0.5) * 16;
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        // Read layout once per frame before writing the light positions.
        const bounds = panel?.getBoundingClientRect();
        layer.style.setProperty('--ribbon-x', `${x}px`);
        layer.style.setProperty('--ribbon-y', `${y}px`);
        layer.style.setProperty('--spotlight-x', `${cursorX}px`);
        layer.style.setProperty('--spotlight-y', `${cursorY}px`);
        layer.dataset.hover = 'true';
        if (litPanel !== panel) {
          clearPanel();
          litPanel = panel;
        }
        if (panel && bounds) {
          panel.style.setProperty('--hover-x', `${cursorX - bounds.left}px`);
          panel.style.setProperty('--hover-y', `${cursorY - bounds.top}px`);
          panel.dataset.hoverLit = 'true';
        }
        frame = null;
      });
    };

    sync();
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('blur', reset);
    window.addEventListener('resize', reset);
    window.addEventListener('scroll', reset, { passive: true });
    document.documentElement.addEventListener('pointerleave', reset);
    document.addEventListener('visibilitychange', sync);
    motion.addEventListener('change', sync);
    return () => {
      reset();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('blur', reset);
      window.removeEventListener('resize', reset);
      window.removeEventListener('scroll', reset);
      document.documentElement.removeEventListener('pointerleave', reset);
      document.removeEventListener('visibilitychange', sync);
      motion.removeEventListener('change', sync);
    };
  }, [paused]);

  return (
    <>
      <div ref={layerRef} className="ambient-ribbon-background" data-animation="ambient-ribbons" data-paused={paused} aria-hidden="true">
        <div className="ambient-ribbon-parallax">
          <span className="ambient-ribbon ambient-ribbon-rose" />
          <span className="ambient-ribbon ambient-ribbon-violet" />
          <span className="ambient-ribbon ambient-ribbon-teal" />
        </div>
        <div className="ambient-cursor-spotlight" />
      </div>
      <button
        type="button"
        onClick={() => setPaused((value) => !value)}
        className="ribbon-motion-control"
        aria-label={paused ? 'Resume background motion' : 'Pause background motion'}
        aria-pressed={paused}
        title={paused ? 'Resume background motion' : 'Pause background motion'}
      >
        {paused ? <Play aria-hidden="true" className="h-3.5 w-3.5" /> : <Pause aria-hidden="true" className="h-3.5 w-3.5" />}
        <span>{paused ? 'Motion off' : 'Motion on'}</span>
      </button>
    </>
  );
}
