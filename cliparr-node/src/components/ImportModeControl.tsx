import { useState, useEffect } from 'react';

function ImportModeControl() {
  const [mode, setMode] = useState('loading...');
  const [error, setError] = useState<string | null>(null);
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
    } catch (err: any) {
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
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchMode();
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="import-mode-select" className="font-medium">Import Mode:</label>
      <div className="flex items-center gap-4">
        <span className="text-gray-300">Current: <b>{mode}</b></span>
        <select
          id="import-mode-select"
          value={mode}
          onChange={(e) => updateMode(e.target.value)}
          disabled={saving || mode === 'loading...'}
          className="border border-gray-700 rounded px-2 py-1 bg-gray-800 text-gray-100"
        >
          <option value="none">None</option>
          <option value="import">Import</option>
          <option value="auto">Auto</option>
        </select>
        {saving && <span className="ml-2 text-sm text-gray-500">Saving...</span>}
      </div>
      {error && <div className="text-red-400 text-sm">Error: {error}</div>}
    </div>
  );
}

export default ImportModeControl; 