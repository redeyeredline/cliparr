import React, { useEffect, useState } from 'react';
import { Spin } from 'antd';

function LogFiles() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/logs')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch logs');
        return res.json();
      })
      .then(data => {
        setLogs(data.files || []);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load log files.');
        setLoading(false);
      });
  }, []);

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <Spin size="large" tip="Loading..." />
    </div>
  );

  return (
    <div style={{ padding: '2rem', color: '#fff', background: '#181818', minHeight: '100vh' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Log Files</h1>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {!error && (
        <table style={{ width: '100%', background: '#23272b', borderRadius: 8, overflow: 'hidden' }}>
          <thead>
            <tr style={{ background: '#23272b', color: '#00bfff' }}>
              <th style={{ textAlign: 'left', padding: '0.75rem 1rem' }}>Filename</th>
              <th style={{ textAlign: 'left', padding: '0.75rem 1rem' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((file) => (
              <tr key={file} style={{ borderBottom: '1px solid #333' }}>
                <td style={{ padding: '0.75rem 1rem' }}>{file}</td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <a
                    href={`/api/logs/${encodeURIComponent(file)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#00bfff', textDecoration: 'underline', fontWeight: 500 }}
                  >
                    Open
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default LogFiles; 