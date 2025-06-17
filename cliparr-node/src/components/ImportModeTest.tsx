import { useState, useEffect } from 'react';

function ImportModeTest() {
  const [mode, setMode] = useState('loading...');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Fetch current mode
  const fetchMode = async () => {
    try {
      const res = await fetch('http://localhost:8485/settings/import-mode');
      const data = await res.json();
      if (res.ok) {
        setMode(data.mode);
        setError(null);
      } else {
        setError(data.error || data.details || 'Failed to fetch import mode');
      }
    } catch (err) {
      setError(err.message || 'Network error');
    }
  };

  // Set mode
  const updateMode = async (newMode: string) => {
    setSaving(true);
    try {
      const res = await fetch('http://localhost:8485/settings/import-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode }),
      });
      const data = await res.json();
      if (res.ok) {
        setMode(data.mode);
        setError(null);
      } else {
        setError(data.error || data.details || 'Failed to set import mode');
      }
    } catch (err) {
      setError(err.message || 'Network error');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchMode();
  }, []);

  return (
    <div>
      <h2>Import Mode Test</h2>
      <div className="mb-2">Current Mode: <b>{mode}</b></div>
      <label htmlFor="import-mode-select" className="mr-2">Import Mode:</label>
      <select
        id="import-mode-select"
        value={mode}
        onChange={e => updateMode(e.target.value)}
        disabled={saving || mode === 'loading...'}
        className="border rounded px-2 py-1"
      >
        <option value="none">None</option>
        <option value="import">Import</option>
        <option value="auto">Auto</option>
      </select>
      {saving && <span className="ml-2 text-sm text-gray-500">Saving...</span>}
      {error && <div style={{ color: 'red' }}>Error: {error}</div>}
    </div>
  );
}

export default ImportModeTest;
