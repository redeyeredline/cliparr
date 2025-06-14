import React, { useState, useEffect } from 'react';

interface DatabaseStatus {
  isConnected: boolean;
  isInitialized: boolean;
  message: string;
}

const DatabaseStatus: React.FC = () => {
  const [status, setStatus] = useState<DatabaseStatus>({
    isConnected: false,
    isInitialized: false,
    message: 'Checking database status...',
  });

  const checkDatabaseStatus = async () => {
    try {
      const response = await fetch('/api/database/test');
      const data = await response.json();
      setStatus((prev) => ({
        ...prev,
        isConnected: data.status === 'success',
        message: data.message,
      }));
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        isConnected: false,
        message: 'Failed to check database status',
      }));
    }
  };

  const initializeDatabase = async () => {
    try {
      const response = await fetch('/api/database/initialize', {
        method: 'POST',
      });
      const data = await response.json();
      setStatus((prev) => ({
        ...prev,
        isInitialized: data.status === 'success',
        message: data.message,
      }));
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        isInitialized: false,
        message: 'Failed to initialize database',
      }));
    }
  };

  useEffect(() => {
    checkDatabaseStatus();
  }, []);

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Database Status</h2>
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <div
            className={`w-3 h-3 rounded-full ${status.isConnected ? 'bg-green-500' : 'bg-red-500'}`}
          />
          <span>Connection Status: {status.isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
        <div className="flex items-center space-x-2">
          <div
            className={`w-3 h-3 rounded-full ${status.isInitialized ? 'bg-green-500' : 'bg-yellow-500'}`}
          />
          <span>Schema Status: {status.isInitialized ? 'Initialized' : 'Not Initialized'}</span>
        </div>
        <p className="text-sm text-gray-600">{status.message}</p>
        <div className="space-x-4">
          <button
            onClick={checkDatabaseStatus}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Check Status
          </button>
          <button
            onClick={initializeDatabase}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
            disabled={status.isInitialized}
          >
            Initialize Database
          </button>
        </div>
      </div>
    </div>
  );
};

export default DatabaseStatus;
