import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import SettingsPage from './pages/SettingsPage';
import { ToastProvider } from './components/ToastProvider';
import MainLayout from './components/layout/MainLayout';
import { ImportModalProvider, ImportModalRoot } from './components/ImportModalProvider';

function App() {
  return (
    <Router>
      <ToastProvider>
        <ImportModalProvider>
          <MainLayout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
            <ImportModalRoot />
          </MainLayout>
        </ImportModalProvider>
      </ToastProvider>
    </Router>
  );
}

export default App;
