import React from 'react';
import { useState, useEffect } from 'react';
import DatabaseStatus from './components/DatabaseStatus';

export default function App() {
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setStatus(data.status))
      .catch((_error) => setStatus('error'));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">Cliparr</h1>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 gap-6">
            <DatabaseStatus />
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                Server Status
              </h2>
              <p className="text-gray-600">
                Current status: <span className="font-medium">{status}</span>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
