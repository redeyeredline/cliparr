import React, { useState, useEffect } from 'react';

function ImportModeSettings() {
  const [mode, setMode] = useState('auto');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchImportMode();
  }, []);

  const fetchImportMode = async () => {
    try {
      const response = await fetch('/api/settings/import-mode');
      const data = await response.json();
      setMode(data.mode);
    } catch (error) {
      setError('Failed to fetch import mode');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = async (newMode) => {
    try {
      setLoading(true);
      const response = await fetch('/api/settings/import-mode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode: newMode }),
      });

      if (!response.ok) {
        throw new Error('Failed to update import mode');
      }

      const data = await response.json();
      setMode(data.mode);
      setError(null);
    } catch (error) {
      setError('Failed to update import mode');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-gray-600">Loading...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-xl font-semibold mb-4">Import Mode Settings</h2>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      <div className="space-y-4">
        <div className="flex items-center space-x-4">
          <label className="inline-flex items-center">
            <input
              type="radio"
              className="form-radio"
              checked={mode === 'auto'}
              onChange={() => handleModeChange('auto')}
              disabled={loading}
            />
            <span className="ml-2">Auto Import</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              className="form-radio"
              checked={mode === 'import'}
              onChange={() => handleModeChange('import')}
              disabled={loading}
            />
            <span className="ml-2">Manual Import</span>
          </label>
        </div>
        <p className="text-sm text-gray-600">
          {mode === 'auto' 
            ? 'Automatically import all shows from Sonarr'
            : 'Only import shows that you manually select'}
        </p>
      </div>
    </div>
  );
}

export default ImportModeSettings; 