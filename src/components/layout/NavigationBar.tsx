import React, { useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useImportModal } from '../ImportModalProvider';
import { useKeyboardNavigation, useFocusRestoration } from '../../utils/keyboardNavigation';
import { Home, Download, Settings, Zap } from 'lucide-react';

interface NavigationBarProps {
  children: React.ReactNode;
}

const NavigationBar: React.FC<NavigationBarProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { openImportModal } = useImportModal();
  const mainContentRef = useRef<HTMLDivElement>(null);
  const { useKeyboardShortcuts, useSkipToContent } = useKeyboardNavigation();
  const { saveFocus } = useFocusRestoration();

  const navItems = [
    { path: '/', label: 'Home', icon: Home, shortcut: 'h' },
    { path: 'import-modal', label: 'Import', icon: Download, isImport: true, shortcut: 'i' },
    { path: '/settings', label: 'Settings', icon: Settings, shortcut: 's' },
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
    const baseClasses = 'group relative w-full flex items-center space-x-3 px-4 py-3 rounded-xl mb-2 transition-all duration-300 font-medium';
    const isActive = location.pathname === item.path && !item.isImport;

    if (isActive) {
      return `${baseClasses} bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-white border border-blue-500/30 shadow-lg shadow-blue-500/10`;
    }

    return `${baseClasses} text-gray-300 hover:text-white hover:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-gray-900`;
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Skip to main content link */}
      <a
        href="#main-content"
        onClick={handleSkipClick}
        className="skip-link sr-only focus:not-sr-only absolute top-4 left-4 z-50 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg"
        aria-label="Skip to main content"
      >
        Skip to main content
      </a>

      {/* Left Sidebar */}
      <aside className="w-72 bg-gray-800/30 backdrop-blur-sm border-r border-gray-700/30 p-6 flex flex-col shadow-2xl" role="navigation" aria-label="Main navigation">
        {/* Logo */}
        <div className="mb-8">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Cliparr</h1>
              <p className="text-xs text-gray-400">Media Manager</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1" role="navigation">
          <div className="space-y-1">
            {navItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = location.pathname === item.path && !item.isImport;

              return (
                <button
                  key={item.label}
                  onClick={() => handleNavClick(item)}
                  onKeyDown={(e) => handleKeyPress(e, item)}
                  className={getButtonClasses(item)}
                  aria-label={`${item.label}${item.shortcut ? ` (Press ${item.shortcut.toUpperCase()})` : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <div className="relative">
                    <IconComponent className={`w-5 h-5 transition-all duration-300 ${isActive ? 'text-blue-400' : 'text-gray-400 group-hover:text-white'}`} />
                    {isActive && (
                      <div className="absolute inset-0 bg-blue-400/20 rounded-lg blur-sm"></div>
                    )}
                  </div>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.shortcut && (
                    <span className="text-xs text-gray-500 bg-gray-700/50 px-2 py-1 rounded-md font-mono">
                      {item.shortcut.toUpperCase()}
                    </span>
                  )}

                  {/* Active indicator */}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-blue-500 to-purple-600 rounded-r-full"></div>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="pt-6 border-t border-gray-700/30">
          <div className="text-xs text-gray-500 text-center">
            <p>Version 1.0.0</p>
          </div>
        </div>
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

export default NavigationBar;
