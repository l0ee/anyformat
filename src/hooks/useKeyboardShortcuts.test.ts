import { describe, expect, it, vi } from 'vitest';
import {
  handleKeyboardShortcut,
  isEditableElement,
  KeyboardShortcutHandlers,
} from './useKeyboardShortcuts';

describe('useKeyboardShortcuts / handleKeyboardShortcut', () => {
  const createHandlers = (overrides: Partial<KeyboardShortcutHandlers> = {}) => ({
    onHelp: vi.fn(),
    onCommandK: vi.fn(),
    onEscape: vi.fn(),
    onNextTab: vi.fn(),
    onPrevTab: vi.fn(),
    onTabSelect: vi.fn(),
    onToggleTheme: vi.fn(),
    onConvert: vi.fn(),
    ...overrides,
  });

  describe('isEditableElement', () => {
    it('detects input, textarea, and select elements', () => {
      expect(isEditableElement({ tagName: 'INPUT' })).toBe(true);
      expect(isEditableElement({ tagName: 'textarea' })).toBe(true);
      expect(isEditableElement({ tagName: 'SELECT' })).toBe(true);
    });

    it('detects contentEditable elements', () => {
      expect(isEditableElement({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    });

    it('returns false for regular elements or null', () => {
      expect(isEditableElement(null)).toBe(false);
      expect(isEditableElement(undefined)).toBe(false);
      expect(isEditableElement({ tagName: 'DIV' })).toBe(false);
      expect(isEditableElement({ tagName: 'BUTTON' })).toBe(false);
    });
  });

  describe('shortcut handling', () => {
    it('triggers onHelp when ? is pressed', () => {
      const handlers = createHandlers();
      const preventDefault = vi.fn();

      handleKeyboardShortcut({ key: '?', preventDefault }, handlers);

      expect(handlers.onHelp).toHaveBeenCalledTimes(1);
      expect(preventDefault).toHaveBeenCalledTimes(1);
    });

    it('triggers onCommandK on Cmd+K or Ctrl+K', () => {
      const handlers = createHandlers();
      const preventDefault = vi.fn();

      handleKeyboardShortcut({ key: 'k', metaKey: true, preventDefault }, handlers);
      expect(handlers.onCommandK).toHaveBeenCalledTimes(1);

      handleKeyboardShortcut({ key: 'K', ctrlKey: true, preventDefault }, handlers);
      expect(handlers.onCommandK).toHaveBeenCalledTimes(2);
    });

    it('triggers onConvert on Cmd+Enter or Ctrl+Enter', () => {
      const handlers = createHandlers();
      const preventDefault = vi.fn();

      handleKeyboardShortcut({ key: 'Enter', metaKey: true, preventDefault }, handlers);
      expect(handlers.onConvert).toHaveBeenCalledTimes(1);
      expect(preventDefault).toHaveBeenCalledTimes(1);

      handleKeyboardShortcut({ key: 'Enter', ctrlKey: true, preventDefault }, handlers);
      expect(handlers.onConvert).toHaveBeenCalledTimes(2);
      expect(preventDefault).toHaveBeenCalledTimes(2);
    });

    it('triggers onEscape when Escape is pressed even if in editable element', () => {
      const handlers = createHandlers();
      const preventDefault = vi.fn();

      handleKeyboardShortcut(
        { key: 'Escape', target: { tagName: 'INPUT' }, preventDefault },
        handlers
      );

      expect(handlers.onEscape).toHaveBeenCalledTimes(1);
      expect(preventDefault).toHaveBeenCalledTimes(1);
    });

    it('triggers onToggleTheme when Shift+T is pressed', () => {
      const handlers = createHandlers();
      const preventDefault = vi.fn();

      handleKeyboardShortcut({ key: 'T', shiftKey: true, preventDefault }, handlers);
      expect(handlers.onToggleTheme).toHaveBeenCalledTimes(1);

      handleKeyboardShortcut({ key: 't', shiftKey: true, preventDefault }, handlers);
      expect(handlers.onToggleTheme).toHaveBeenCalledTimes(2);
    });

    it('triggers onTabSelect when 1, 2, or 3 is pressed', () => {
      const handlers = createHandlers();

      handleKeyboardShortcut({ key: '1' }, handlers);
      expect(handlers.onTabSelect).toHaveBeenCalledWith(1);

      handleKeyboardShortcut({ key: '2' }, handlers);
      expect(handlers.onTabSelect).toHaveBeenCalledWith(2);

      handleKeyboardShortcut({ key: '3' }, handlers);
      expect(handlers.onTabSelect).toHaveBeenCalledWith(3);
    });

    it('triggers onNextTab on Alt+ArrowRight or Ctrl+PageDown', () => {
      const handlers = createHandlers();

      handleKeyboardShortcut({ key: 'ArrowRight', altKey: true }, handlers);
      expect(handlers.onNextTab).toHaveBeenCalledTimes(1);

      handleKeyboardShortcut({ key: 'PageDown', ctrlKey: true }, handlers);
      expect(handlers.onNextTab).toHaveBeenCalledTimes(2);
    });

    it('triggers onPrevTab on Alt+ArrowLeft or Ctrl+PageUp', () => {
      const handlers = createHandlers();

      handleKeyboardShortcut({ key: 'ArrowLeft', altKey: true }, handlers);
      expect(handlers.onPrevTab).toHaveBeenCalledTimes(1);

      handleKeyboardShortcut({ key: 'PageUp', ctrlKey: true }, handlers);
      expect(handlers.onPrevTab).toHaveBeenCalledTimes(2);
    });

    it('ignores single-key shortcuts when focus is inside an input or textarea', () => {
      const handlers = createHandlers();

      handleKeyboardShortcut({ key: '?', target: { tagName: 'INPUT' } }, handlers);
      expect(handlers.onHelp).not.toHaveBeenCalled();

      handleKeyboardShortcut({ key: '1', target: { tagName: 'TEXTAREA' } }, handlers);
      expect(handlers.onTabSelect).not.toHaveBeenCalled();

      handleKeyboardShortcut({ key: 'T', shiftKey: true, target: { isContentEditable: true } }, handlers);
      expect(handlers.onToggleTheme).not.toHaveBeenCalled();
    });
  });
});
