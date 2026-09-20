import { useEffect } from 'react';

export interface KeyboardShortcutHandlers {
  onHelp?: () => void;
  onCommandK?: () => void;
  onEscape?: () => void;
  onNextTab?: () => void;
  onPrevTab?: () => void;
  enabled?: boolean;
}

const isEditableElement = (element: Element | null): boolean => {
  if (!element || !(element instanceof HTMLElement)) return false;
  const tagName = element.tagName.toLowerCase();
  if (['input', 'textarea', 'select'].includes(tagName)) {
    return true;
  }
  if (element.isContentEditable) {
    return true;
  }
  return false;
};

export const useKeyboardShortcuts = ({
  onHelp,
  onCommandK,
  onEscape,
  onNextTab,
  onPrevTab,
  enabled = true,
}: KeyboardShortcutHandlers): void => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as Element | null;
      const inInput = isEditableElement(target);

      // Escape is usually safe to trigger even in inputs (e.g. to blur or close modals)
      if (event.key === 'Escape') {
        if (onEscape) {
          event.preventDefault();
          onEscape();
        }
        return;
      }

      // Cmd+K or Ctrl+K (Command palette / search shortcut)
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        if (onCommandK) {
          event.preventDefault();
          onCommandK();
        }
        return;
      }

      // Tab switching shortcuts: Alt+ArrowRight, Alt+ArrowLeft, Ctrl+PageDown, Ctrl+PageUp
      if (
        (event.altKey && event.key === 'ArrowRight') ||
        (event.ctrlKey && event.key === 'PageDown')
      ) {
        if (onNextTab) {
          event.preventDefault();
          onNextTab();
        }
        return;
      }

      if (
        (event.altKey && event.key === 'ArrowLeft') ||
        (event.ctrlKey && event.key === 'PageUp')
      ) {
        if (onPrevTab) {
          event.preventDefault();
          onPrevTab();
        }
        return;
      }

      // Short-circuit all remaining single key shortcuts if user is typing in input or contenteditable
      if (inInput) return;

      // '?' key shortcut for help modal/overlay
      if (event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (onHelp) {
          event.preventDefault();
          onHelp();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onHelp, onCommandK, onEscape, onNextTab, onPrevTab, enabled]);
};
