// Main React application component that sets up routing and global providers.
// Defines the application structure with navigation and toast/import modal contexts.
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import NavigationBar from './components/layout/NavigationBar';
import { ToastProvider } from './components/ToastProvider';
import { ImportModalProvider } from './components/ImportModalProvider';

// Lazy load page components to reduce initial bundle size
const HomePage = lazy(() => import('./pages/HomePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const SystemPage = lazy(() => import('./pages/SystemPage'));
const ShowDetailsPage = lazy(() => import('./pages/ShowDetailsPage'));
const HardwarePage = lazy(() => import('./pages/Hardware'));
const ProcessingPage = lazy(() => import('./pages/Processing'));
const ReviewPage = lazy(() => import('./pages/Review'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

// Loading component for lazy-loaded pages
const PageLoading = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

function App() {
  return (
    <Router>
      <ToastProvider>
        <ImportModalProvider>
          <NavigationBar>
            <Suspense fallback={<PageLoading />}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/shows/:id" element={<ShowDetailsPage />} />
                <Route path="/hardware" element={<HardwarePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/system" element={<SystemPage />} />
                <Route path="/processing" element={<ProcessingPage />} />
                <Route path="/review" element={<ReviewPage />} />
                <Route path="/admin" element={<AdminPage />} />
              </Routes>
            </Suspense>
          </NavigationBar>
        </ImportModalProvider>
      </ToastProvider>
    </Router>
  );
}

export default App;
