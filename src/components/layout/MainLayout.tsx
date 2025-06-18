import React, { useRef, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useImportModal } from '../ImportModalProvider';
import { useKeyboardNavigation, useFocusRestoration } from '../../utils/keyboardNavigation';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { openImportModal } = useImportModal();
  const mainContentRef = useRef<HTMLDivElement>(null);
  const { useKeyboardShortcuts, useSkipToContent } = useKeyboardNavigation();
  const { saveFocus, restoreFocus } = useFocusRestoration();

  const navItems = [
    { path: '/', label: 'Home', icon: '🏠', shortcut: 'h' },
    { path: 'import-modal', label: 'Import', icon: '📥', isImport: true, shortcut: 'i' },
    { path: '/settings', label: 'Settings', icon: '⚙️', shortcut: 's' },
  ];

  // Keyboard shortcuts for navigation
  const shortcuts = {
    'h': () => navigate('/'),
    's': () => navigate('/settings'),
    'i': () => openImportModal(),
    'Escape': () => {
      // Close any open modals or return to previous page
      if (location.pathname !== '/') {
        navigate('/');
      }
    },
  };

  const handleKeyDown = useKeyboardShortcuts(shortcuts);
  const handleSkipClick = useSkipToContent(mainContentRef);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleNavClick = (item: typeof navItems[0]) => {
    saveFocus();
    if (item.isImport) {
      openImportModal();
    } else {
      navigate(item.path);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, item: typeof navItems[0]) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleNavClick(item);
    }
  };

  const getButtonClasses = (item: typeof navItems[0]) => {
    const baseClasses = 'w-full flex items-center space-x-3 px-4 py-3 rounded-lg mb-2 transition-all duration-200';
    const textClasses = 'text-gray-300';
    const isActive = location.pathname === item.path;

    // Don't apply active styles to Import button
    if (item.isImport) {
      return `${baseClasses} ${textClasses} hover:bg-gray-700 hover:text-white focus:outline-none`;
    }

    // Active state for regular nav items
    if (isActive) {
      return `${baseClasses} bg-blue-900/50 text-white focus:outline-none`;
    }

    // Default state with hover for inactive items
    return `${baseClasses} ${textClasses} hover:bg-gray-700 hover:text-white focus:outline-none`;
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      {/* Skip to main content link */}
      <a
        href="#main-content"
        onClick={handleSkipClick}
        className="skip-link sr-only focus:not-sr-only"
        aria-label="Skip to main content"
      >
        Skip to main content
      </a>

      {/* Left Sidebar */}
      <aside className="w-64 bg-gray-800 p-4 flex flex-col" role="navigation" aria-label="Main navigation">
        <div className="text-xl font-bold mb-8">Cliparr</div>
        <nav className="flex-1" role="navigation">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNavClick(item)}
              onKeyDown={(e) => handleKeyPress(e, item)}
              className={getButtonClasses(item)}
              aria-label={`${item.label}${item.shortcut ? ` (Press ${item.shortcut.toUpperCase()})` : ''}`}
              aria-current={!item.isImport && location.pathname === item.path ? 'page' : undefined}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main
        id="main-content"
        ref={mainContentRef}
        className="flex-1 flex flex-col overflow-hidden"
        role="main"
        tabIndex={-1}
      >
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
