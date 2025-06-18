import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import HealthCheckPage from './pages/HealthCheckPage';
import ToastTest from './pages/ToastTest';
import ImportModalTest from './pages/ImportModalTest';
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
              <Route path="/health" element={<HealthCheckPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/toast-test" element={<ToastTest />} />
              <Route path="/import-test" element={<ImportModalTest />} />
            </Routes>
            <ImportModalRoot />
          </MainLayout>
        </ImportModalProvider>
      </ToastProvider>
    </Router>
  );
}

export default App;
