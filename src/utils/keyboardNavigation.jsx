// Comprehensive keyboard navigation utilities for React components including focus management.
// Provides arrow key navigation, focus traps, keyboard shortcuts, and accessibility features.
import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Hook for managing keyboard navigation
 * Provides utilities for focus management, keyboard shortcuts, and accessibility
 */
export const useKeyboardNavigation = () => {
  // Get all focusable elements within a container
  const getFocusableElements = useCallback((container) => {
    if (!container) {
      return [];
    }

    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
      'summary',
      'details',
    ];

    return Array.from(container.querySelectorAll(focusableSelectors.join(', '))).filter((el) => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }, []);

  // Focus trap for modals and dialogs
  const createFocusTrap = useCallback(
    (containerRef) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const elements = getFocusableElements(container);
      if (elements.length === 0) {
        return;
      }

      const firstElement = elements[0];
      const lastElement = elements[elements.length - 1];

      const handleKeyDown = (e) => {
        if (e.key === 'Tab') {
          if (e.shiftKey) {
            // Shift + Tab: move backwards
            if (document.activeElement === firstElement) {
              e.preventDefault();
              lastElement.focus();
            }
          } else {
            // Tab: move forwards
            if (document.activeElement === lastElement) {
              e.preventDefault();
              firstElement.focus();
            }
          }
        }
      };

      container.addEventListener('keydown', handleKeyDown);
      firstElement.focus();

      return () => {
        container.removeEventListener('keydown', handleKeyDown);
      };
    },
    [getFocusableElements],
  );

  // Arrow key navigation for lists and grids
  const useArrowNavigation = useCallback(
    (containerRef, options = {}) => {
      const {
        direction = 'vertical', // 'vertical', 'horizontal', 'grid'
        wrap = false,
        onNavigate = null,
      } = options;

      const handleArrowKeys = (e) => {
        const container = containerRef.current;
        if (!container) {
          return;
        }

        const elements = getFocusableElements(container);
        if (elements.length === 0) {
          return;
        }

        const currentIndex = elements.indexOf(document.activeElement);
        if (currentIndex === -1) {
          return;
        }

        let nextIndex = currentIndex;

        switch (e.key) {
          case 'ArrowDown':
            if (direction === 'vertical' || direction === 'grid') {
              e.preventDefault();
              nextIndex = currentIndex + 1;
              if (nextIndex >= elements.length) {
                nextIndex = wrap ? 0 : currentIndex;
              }
            }
            break;
          case 'ArrowUp':
            if (direction === 'vertical' || direction === 'grid') {
              e.preventDefault();
              nextIndex = currentIndex - 1;
              if (nextIndex < 0) {
                nextIndex = wrap ? elements.length - 1 : currentIndex;
              }
            }
            break;
          case 'ArrowRight':
            if (direction === 'horizontal' || direction === 'grid') {
              e.preventDefault();
              nextIndex = currentIndex + 1;
              if (nextIndex >= elements.length) {
                nextIndex = wrap ? 0 : currentIndex;
              }
            }
            break;
          case 'ArrowLeft':
            if (direction === 'horizontal' || direction === 'grid') {
              e.preventDefault();
              nextIndex = currentIndex - 1;
              if (nextIndex < 0) {
                nextIndex = wrap ? elements.length - 1 : currentIndex;
              }
            }
            break;
          case 'Home':
            e.preventDefault();
            nextIndex = 0;
            break;
          case 'End':
            e.preventDefault();
            nextIndex = elements.length - 1;
            break;
        }

        if (nextIndex !== currentIndex) {
          elements[nextIndex].focus();
          if (onNavigate) {
            onNavigate(nextIndex, elements[nextIndex]);
          }
        }
      };

      return handleArrowKeys;
    },
    [getFocusableElements],
  );

  // Keyboard shortcuts manager
  const useKeyboardShortcuts = useCallback((shortcuts) => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey;
      const shift = e.shiftKey;
      const alt = e.altKey;
      const meta = e.metaKey;

      // Don't trigger shortcuts when typing in input fields
      if (
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.contentEditable === 'true'
      ) {
        return;
      }

      for (const [shortcut, handler] of Object.entries(shortcuts)) {
        const [shortcutKey, ...modifiers] = shortcut.toLowerCase().split('+');

        if (key === shortcutKey) {
          const hasCtrl = modifiers.includes('ctrl') === ctrl;
          const hasShift = modifiers.includes('shift') === shift;
          const hasAlt = modifiers.includes('alt') === alt;
          const hasMeta = modifiers.includes('meta') === meta;

          if (hasCtrl && hasShift && hasAlt && hasMeta) {
            e.preventDefault();
            handler(e);
            break;
          }
        }
      }
    };

    return handleKeyDown;
  }, []);

  // Skip to main content functionality
  const useSkipToContent = useCallback((mainContentRef) => {
    const handleSkipClick = (e) => {
      e.preventDefault();
      if (mainContentRef.current) {
        mainContentRef.current.focus();
        mainContentRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    };

    return handleSkipClick;
  }, []);

  return {
    getFocusableElements,
    createFocusTrap,
    useArrowNavigation,
    useKeyboardShortcuts,
    useSkipToContent,
  };
};

/**
 * Hook for managing focus restoration
 * Restores focus to the previously focused element when a modal closes
 */
export const useFocusRestoration = () => {
  const previousFocus = useRef(null);

  const saveFocus = useCallback(() => {
    previousFocus.current = document.activeElement;
  }, []);

  const restoreFocus = useCallback(() => {
    if (previousFocus.current && previousFocus.current.focus) {
      previousFocus.current.focus();
    }
  }, []);

  return { saveFocus, restoreFocus };
};

/**
 * Hook for managing keyboard navigation state
 * Tracks whether the user is using keyboard navigation
 */
export const useKeyboardNavigationState = () => {
  const [isKeyboardNavigating, setIsKeyboardNavigating] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Tab') {
        setIsKeyboardNavigating(true);
      }
    };

    const handleMouseDown = () => {
      setIsKeyboardNavigating(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  return isKeyboardNavigating;
};

/**
 * Utility function to check if an element is visible
 */
export const isElementVisible = (element) => {
  if (!element) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0'
  );
};

/**
 * Utility function to scroll element into view with offset
 */
export const scrollIntoView = (element, offset = 0) => {
  if (!element) {
    return;
  }

  const elementRect = element.getBoundingClientRect();
  const containerRect = document.documentElement.getBoundingClientRect();

  const isAbove = elementRect.top < containerRect.top + offset;
  const isBelow = elementRect.bottom > containerRect.bottom - offset;

  if (isAbove || isBelow) {
    element.scrollIntoView({
      behavior: 'smooth',
      block: isAbove ? 'start' : 'end',
      inline: 'nearest',
    });
  }
};

/**
 * Common keyboard shortcuts for the application
 */
export const COMMON_SHORTCUTS = {
  // Navigation
  h: 'Navigate to Home',
  s: 'Navigate to Settings',
  i: 'Open Import Modal',

  // Actions
  'ctrl+a': 'Select All',
  'ctrl+d': 'Deselect All',
  Delete: 'Delete Selected',
  Enter: 'Activate/Confirm',
  Escape: 'Close/Cancel',

  // Search and Filter
  'ctrl+f': 'Focus Search',
  'ctrl+k': 'Focus Search',

  // Table Navigation
  ArrowUp: 'Previous Row',
  ArrowDown: 'Next Row',
  Home: 'First Row',
  End: 'Last Row',
  PageUp: 'Previous Page',
  PageDown: 'Next Page',
};

/**
 * Accessibility utilities
 */
export const accessibilityUtils = {
  // Generate ARIA labels
  generateAriaLabel: (action, target) => `${action} ${target}`,

  // Generate ARIA descriptions
  generateAriaDescription: (description) => description,

  // Check if element should be focusable
  shouldBeFocusable: (element) => {
    const tag = element.tagName.toLowerCase();

    return (
      tag === 'button' ||
      tag === 'input' ||
      tag === 'select' ||
      tag === 'textarea' ||
      tag === 'a' ||
      element.hasAttribute('tabindex') ||
      element.contentEditable === 'true'
    );
  },

  // Get accessible name for an element
  getAccessibleName: (element) => {
    return (
      element.getAttribute('aria-label') ||
      element.getAttribute('title') ||
      element.textContent?.trim() ||
      element.alt ||
      ''
    );
  },
};
