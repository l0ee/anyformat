import React, { useEffect, useRef } from 'react';

export interface HoverBackgroundProps {
  className?: string;
  enabled?: boolean;
}

export const HoverBackground: React.FC<HoverBackgroundProps> = ({ className = '', enabled = true }) => {
  const blobRef = useRef<HTMLDivElement>(null);
  const tickingRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mousePosRef = useRef({ x: 0, y: 0, isHovering: false });

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !('matchMedia' in window)) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const hoverQuery = window.matchMedia('(hover: hover)');
    if (motionQuery.matches || !hoverQuery.matches) return;

    const setGlowOpacity = (opacity: '0' | '1') => {
      if (blobRef.current) {
        blobRef.current.style.opacity = opacity;
      }
    };

    const isInteractiveTarget = (target: EventTarget | null) =>
      target instanceof Element &&
      Boolean(
        target.closest(
          'a, button, input, select, textarea, label, [role="button"], [role="slider"], [role="dialog"], [contenteditable="true"]'
        )
      );

    const resetIdleTimer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        setGlowOpacity('0');
      }, 2000);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;

      if (isInteractiveTarget(e.target)) {
        mousePosRef.current.isHovering = false;
        setGlowOpacity('0');
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        return;
      }

      mousePosRef.current = {
        x: e.clientX,
        y: e.clientY,
        isHovering: true,
      };

      resetIdleTimer();

      if (!tickingRef.current) {
        tickingRef.current = true;
        frameRef.current = requestAnimationFrame(() => {
          if (blobRef.current) {
            const { x, y } = mousePosRef.current;
            blobRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
            setGlowOpacity('1');
          }
          tickingRef.current = false;
          frameRef.current = null;
        });
      }
    };

    const handlePointerLeave = () => {
      mousePosRef.current.isHovering = false;
      setGlowOpacity('0');
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handlePointerLeave();
      }
    };

    const handleMotionChange = (e: MediaQueryListEvent) => {
      if (e.matches) handlePointerLeave();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerleave', handlePointerLeave);
    document.addEventListener('mouseleave', handlePointerLeave);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    motionQuery.addEventListener('change', handleMotionChange);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
      document.removeEventListener('mouseleave', handlePointerLeave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      motionQuery.removeEventListener('change', handleMotionChange);
    };
  }, [enabled]);

  return (
    <div
      ref={blobRef}
      aria-hidden="true"
      className={`hover-glow-blob pointer-events-none fixed top-0 left-0 z-0 opacity-0 transition-opacity duration-500 ${className}`}
    />
  );
};
