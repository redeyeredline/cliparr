import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useImportModal } from '../ImportModalProvider';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { openImportModal } = useImportModal();

  const navItems = [
    { path: '/', label: 'Home', icon: '🏠' },
    { path: 'import-modal', label: 'Import', icon: '📥', isImport: true },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      {/* Left Sidebar */}
      <div className="w-64 bg-gray-800 p-4 flex flex-col">
        <div className="text-xl font-bold mb-8">Cliparr</div>
        <nav className="flex-1">
          {navItems.map((item) => (
            item.isImport ? (
              <button
                key={item.label}
                onClick={openImportModal}
                className="w-full flex items-center space-x-3 px-4 py-2 rounded-lg mb-2 transition-colors text-gray-300 hover:bg-gray-700 hover:text-white focus:bg-gray-700 focus:text-white"
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ) : (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg mb-2 transition-colors${location.pathname === item.path ? ' bg-gray-700 text-white' : ' text-gray-300 hover:bg-gray-700 hover:text-white'}`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            )
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
};

export default MainLayout;
