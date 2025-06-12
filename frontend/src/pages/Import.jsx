import React, { useEffect, useState } from 'react';

function Import() {
  const [shows, setShows] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/sonarr/unimported')
      .then(res => res.json())
      .then(data => {
        setShows(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const toggleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  };

  const handleImport = async () => {
    if (selected.length === 0) {
      setMessage('Please select at least one show to import.');
      return;
    }
    setImporting(true);
    setMessage('Importing...');
    try {
      const res = await fetch('/api/sonarr/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showIds: selected })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Successfully imported ${data.importedCount} shows.`);
        setSelected([]);
        // Optionally, refresh the list
        fetch('/api/sonarr/unimported')
          .then(res => res.json())
          .then(data => setShows(data));
      } else {
        setMessage(data.error || 'Import failed.');
      }
    } catch (e) {
      setMessage('Import failed.');
    }
    setImporting(false);
  };

  if (loading) return <div>Loading available shows...</div>;

  return (
    <div style={{ maxWidth: 900, margin: '2rem auto' }}>
      <h1>Import Shows from Sonarr</h1>
      {message && <div style={{ margin: '1rem 0', color: 'orange' }}>{message}</div>}
      {shows.length === 0 ? (
        <div>All shows have been imported! <a href="/" style={{ color: '#fff', textDecoration: 'none', padding: '0.5rem 1rem', border: '1px solid #fff', borderRadius: '4px' }}>Go Home</a></div>
      ) : (
        <>
          <table style={{ width: '100%', marginBottom: '1rem', color: '#fff' }}>
            <thead>
              <tr>
                <th>Select</th>
                <th>Title</th>
                <th>Seasons</th>
                <th>Episodes</th>
                <th>Path</th>
              </tr>
            </thead>
            <tbody>
              {shows.map(show => (
                <tr key={show.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.includes(show.id)}
                      onChange={() => toggleSelect(show.id)}
                    />
                  </td>
                  <td>{show.title}</td>
                  <td>{show.seasons?.length ?? 0}</td>
                  <td>{show.statistics?.episodeFileCount ?? 0}</td>
                  <td>{show.path}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button 
            onClick={handleImport} 
            disabled={importing} 
            style={{ 
              fontSize: '1.1rem', 
              padding: '0.7rem 2rem',
              backgroundColor: '#222',
              color: '#fff',
              border: '1px solid #fff',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {importing ? 'Importing...' : 'Import Selected Shows'}
          </button>
          <a 
            href="/" 
            style={{ 
              marginLeft: '1rem',
              color: '#fff',
              textDecoration: 'none',
              padding: '0.7rem 2rem',
              border: '1px solid #fff',
              borderRadius: '4px',
              display: 'inline-block'
            }}
          >
            Back Home
          </a>
        </>
      )}
    </div>
  );
}

export default Import; 