import { useEffect } from 'react';

export interface KeyboardShortcutHandlers {
  onHelp?: () => void;
  onCommandK?: () => void;
  onEscape?: () => void;
  onNextTab?: () => void;
  onPrevTab?: () => void;
  onTabSelect?: (tabIndex: 1 | 2 | 3) => void;
  onToggleTheme?: () => void;
  onConvert?: () => void;
  enabled?: boolean;
}

export interface KeyboardEventLike {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  target?: unknown;
  preventDefault?: () => void;
}

export const isEditableElement = (element: unknown): boolean => {
  if (!element || typeof element !== 'object') return false;
  const el = element as { tagName?: string; isContentEditable?: boolean };
  const tagName = el.tagName ? String(el.tagName).toLowerCase() : '';
  if (['input', 'textarea', 'select'].includes(tagName)) {
    return true;
  }
  if (el.isContentEditable) {
    return true;
  }
  return false;
};

export const handleKeyboardShortcut = (
  event: KeyboardEventLike,
  handlers: KeyboardShortcutHandlers
): void => {
  const target = event.target ?? null;
  const inInput = isEditableElement(target);

  // Escape is usually safe to trigger even in inputs (e.g. to blur or close modals)
  if (event.key === 'Escape') {
    if (handlers.onEscape) {
      event.preventDefault?.();
      handlers.onEscape();
    }
    return;
  }

  // Cmd+K or Ctrl+K (Command palette / search shortcut)
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    if (handlers.onCommandK) {
      event.preventDefault?.();
      handlers.onCommandK();
    }
    return;
  }

  // Cmd+Enter or Ctrl+Enter (Trigger conversion / batch process)
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    if (handlers.onConvert) {
      event.preventDefault?.();
      handlers.onConvert();
    }
    return;
  }

  // Tab switching shortcuts: Alt+ArrowRight, Alt+ArrowLeft, Ctrl+PageDown, Ctrl+PageUp
  if (
    (event.altKey && event.key === 'ArrowRight') ||
    (event.ctrlKey && event.key === 'PageDown')
  ) {
    if (handlers.onNextTab) {
      event.preventDefault?.();
      handlers.onNextTab();
    }
    return;
  }

  if (
    (event.altKey && event.key === 'ArrowLeft') ||
    (event.ctrlKey && event.key === 'PageUp')
  ) {
    if (handlers.onPrevTab) {
      event.preventDefault?.();
      handlers.onPrevTab();
    }
    return;
  }

  // Short-circuit all remaining single key shortcuts if user is typing in input or contenteditable
  if (inInput) return;

  // '?' key shortcut for help modal/overlay
  if (event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey) {
    if (handlers.onHelp) {
      event.preventDefault?.();
      handlers.onHelp();
    }
    return;
  }

  // Shift + T shortcut for theme toggle
  if (event.shiftKey && (event.key === 'T' || event.key === 't') && !event.ctrlKey && !event.metaKey && !event.altKey) {
    if (handlers.onToggleTheme) {
      event.preventDefault?.();
      handlers.onToggleTheme();
    }
    return;
  }

  // 1 / 2 / 3 shortcut for tab switching
  if (['1', '2', '3'].includes(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
    if (handlers.onTabSelect) {
      event.preventDefault?.();
      handlers.onTabSelect(Number(event.key) as 1 | 2 | 3);
    }
    return;
  }
};

export const useKeyboardShortcuts = ({
  onHelp,
  onCommandK,
  onEscape,
  onNextTab,
  onPrevTab,
  onTabSelect,
  onToggleTheme,
  onConvert,
  enabled = true,
}: KeyboardShortcutHandlers): void => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      handleKeyboardShortcut(event, {
        onHelp,
        onCommandK,
        onEscape,
        onNextTab,
        onPrevTab,
        onTabSelect,
        onToggleTheme,
        onConvert,
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onHelp, onCommandK, onEscape, onNextTab, onPrevTab, onTabSelect, onToggleTheme, onConvert, enabled]);
};
