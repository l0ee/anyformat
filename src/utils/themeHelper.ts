import React from 'react';

export type AccentTheme = 'emerald' | 'violet' | 'rose' | 'amber';

export interface AccentThemeOption {
  id: AccentTheme;
  name: string;
  colorClass: string;
}

export const ACCENT_THEMES: AccentThemeOption[] = [
  { id: 'emerald', name: 'Emerald', colorClass: 'bg-emerald-500 hover:bg-emerald-400' },
  { id: 'violet', name: 'Violet', colorClass: 'bg-violet-500 hover:bg-violet-400' },
  { id: 'rose', name: 'Rose', colorClass: 'bg-rose-500 hover:bg-rose-400' },
  { id: 'amber', name: 'Amber', colorClass: 'bg-amber-500 hover:bg-amber-400' },
];

interface ThemeTransitionOptions {
  event?: React.MouseEvent;
  onUpdate: () => void;
}

export function toggleThemeWithTransition({ event, onUpdate }: ThemeTransitionOptions) {
  const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Fallback if ViewTransitions API is unavailable or user requested reduced motion
  if (!('startViewTransition' in document) || isReducedMotion) {
    onUpdate();
    return;
  }

  if (event) {
    const x = event.clientX;
    const y = event.clientY;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );
    document.documentElement.style.setProperty('--x', `${x}px`);
    document.documentElement.style.setProperty('--y', `${y}px`);
    document.documentElement.style.setProperty('--r', `${endRadius}px`);
  }

  (document as unknown as { startViewTransition: (cb: () => void) => void }).startViewTransition(() => {
    onUpdate();
  });
}
