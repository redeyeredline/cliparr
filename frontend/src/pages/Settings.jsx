import React, { useEffect, useState } from 'react';
import ImportModal from '../components/ImportModal';

function Settings() {
  const [showModal, setShowModal] = useState(false);
  const [modalShows, setModalShows] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUnimported();
  }, []);

  const fetchUnimported = () => {
    setLoading(true);
    fetch('/api/sonarr/unimported')
      .then(res => res.json())
      .then(data => {
        setShows(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const openImportModal = () => {
    setShowModal(true);
    setModalLoading(true);
    setModalError('');
    fetch('/api/sonarr/unimported')
      .then(res => res.json())
      .then(data => {
        setModalShows(data);
        setModalLoading(false);
      })
      .catch(() => {
        setModalError('Failed to load shows from Sonarr.');
        setModalLoading(false);
      });
  };

  const handleImport = async (selectedIds) => {
    setImporting(true);
    setImportMessage('Importing...');
    try {
      const res = await fetch('/api/sonarr/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showIds: selectedIds })
      });
      const data = await res.json();
      if (res.ok) {
        setImportMessage(`Successfully imported ${data.importedCount} shows.`);
        fetchUnimported();
        setShowModal(false);
      } else {
        setImportMessage(data.error || 'Import failed.');
      }
    } catch (e) {
      setImportMessage('Import failed.');
    }
    setImporting(false);
  };

  if (loading) return <div>Loading unimported shows...</div>;

  return (
    <div style={{ 
      maxWidth: 900, 
      margin: '2rem auto',
      color: '#fff',
      backgroundColor: '#181818',
      padding: '2rem',
      borderRadius: '8px'
    }}>
      <ImportModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onImport={handleImport}
        shows={modalShows}
        loading={modalLoading || importing}
        error={modalError || importMessage}
      />
      <h1>Settings: Import Additional Shows</h1>
      {shows.length === 0 ? (
        <div>All available shows have been imported!</div>
      ) : (
        <button 
          onClick={openImportModal} 
          style={{ 
            fontSize: '1.1rem', 
            padding: '0.7rem 2rem', 
            marginBottom: '2rem',
            backgroundColor: '#222',
            color: '#fff',
            border: '1px solid #fff',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Import Shows
        </button>
      )}
    </div>
  );
}

export default Settings; 