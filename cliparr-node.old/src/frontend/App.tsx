import React, { useEffect, useState } from 'react';
import SonarrTest from './components/SonarrTest.tsx';
import DatabaseTest from './components/DatabaseTest.tsx';

interface DbStatus {
  status: 'success' | 'error' | 'loading';
  timestamp?: string;
}

const App: React.FC = () => {
  const [dbStatus, setDbStatus] = useState<DbStatus>({ status: 'loading' });

  useEffect(() => {
    const verifyDatabase = async () => {
      try {
        const response = await fetch('/api/database/verify');
        const data = await response.json();
        setDbStatus({
          status: data.status === 'success' ? 'success' : 'error',
          timestamp: data.timestamp,
        });
      } catch {
        setDbStatus({ status: 'error' });
      }
    };

    verifyDatabase();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Cliparr</h1>
        </div>
      </header>
      <main>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center space-x-2 mb-4">
                <div
                  className={`w-3 h-3 rounded-full ${
                    dbStatus.status === 'success'
                      ? 'bg-green-500'
                      : dbStatus.status === 'error'
                        ? 'bg-red-500'
                        : 'bg-yellow-500'
                  }`}
                />
                <span className="text-lg font-medium">
                  {dbStatus.status === 'success'
                    ? 'Database Ready'
                    : dbStatus.status === 'error'
                      ? 'Database Error'
                      : 'Checking Database...'}
                </span>
              </div>
              {dbStatus.timestamp && (
                <p className="text-sm text-gray-600">
                  Last verified: {new Date(dbStatus.timestamp).toLocaleString()}
                </p>
              )}
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">Welcome to Cliparr</h2>
              <p className="text-gray-600">
                This is the placeholder page. Features will be added here as we implement them.
              </p>
            </div>
            {/* Sonarr API Test Section */}
            <SonarrTest />
            {/* Database Operations Test Section */}
            <DatabaseTest />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
