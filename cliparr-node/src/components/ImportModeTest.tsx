import { useState, useEffect } from 'react';

function ImportModeTest() {
  const [mode, setMode] = useState('loading...');
  const [error, setError] = useState(null);

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
    }
  };

  useEffect(() => {
    fetchMode();
  }, []);

  return (
    <div>
      <h2>Import Mode Test</h2>
      <div>Current Mode: <b>{mode}</b></div>
      <div>
        {['none', 'import', 'auto'].map((m) => (
          <button key={m} onClick={() => updateMode(m)} disabled={mode === m}>
            Set {m}
          </button>
        ))}
      </div>
      {error && <div style={{ color: 'red' }}>Error: {error}</div>}
    </div>
  );
}

export default ImportModeTest;
