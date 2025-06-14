import React, { useState, useEffect } from 'react';

export default function DatabaseStatus() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/db/status');
        const data = await response.json();
        setStatus(data);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    // Refresh status every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="p-4 bg-gray-100 rounded-lg">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded" />
              <div className="h-4 bg-gray-200 rounded w-5/6" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-red-800 font-medium">Database Error</h3>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  return (
    <div className="p-4 bg-white shadow rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Database Status</h3>
        <span 
          className={`px-2 py-1 text-sm rounded-full ${
            status.status === 'healthy' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}
        >
          {status.status}
        </span>
      </div>
      
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-medium text-gray-500">Version</dt>
          <dd className="mt-1 text-sm text-gray-900">{status.version}</dd>
        </div>
        
        <div>
          <dt className="text-sm font-medium text-gray-500">Size</dt>
          <dd className="mt-1 text-sm text-gray-900">{status.size}</dd>
        </div>
        
        <div>
          <dt className="text-sm font-medium text-gray-500">Shows</dt>
          <dd className="mt-1 text-sm text-gray-900">{status.counts.shows_count}</dd>
        </div>
        
        <div>
          <dt className="text-sm font-medium text-gray-500">Episodes</dt>
          <dd className="mt-1 text-sm text-gray-900">{status.counts.episodes_count}</dd>
        </div>
      </dl>
      
      <div className="mt-4 text-xs text-gray-500">
        Last updated: {new Date(status.timestamp).toLocaleString()}
      </div>
    </div>
  );
} 