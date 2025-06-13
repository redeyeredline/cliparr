import { useEffect, useState } from 'react';
import ImportModal from '../components/ImportModal';
import { useToast } from '../components/ToastProvider';

function Settings({ openImportModal }) {
  const [showModal, setShowModal] = useState(false);
  const [modalShows, setModalShows] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importMode, setImportMode] = useState('none');
  const toast = useToast();

  useEffect(() => {
    fetchUnimported();
    fetch('/api/settings/import-mode')
      .then(res => res.json())
      .then(data => setImportMode(data.mode || 'none'));
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
        if (data.importedShows && data.importedShows.length > 0) {
          const importedShowTitles = data.importedShows.map(show => 
            `${show.title} (${show.episodesImported} episodes)`
          ).join(', ');
          setImportMessage(`Successfully imported ${data.importedCount} shows: ${importedShowTitles}`);
        } else {
          setImportMessage(`Successfully imported ${data.importedCount} shows.`);
        }
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

  const handleModeChange = async (e) => {
    const mode = e.target.value;
    try {
      const res = await fetch('/api/settings/import-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });
      const data = await res.json();
      if (res.ok) {
        setImportMode(mode);
        toast({ type: 'success', message: `Import mode set to '${mode}'.` });
      } else {
        toast({ type: 'error', message: data.error || 'Failed to set import mode.' });
      }
    } catch (e) {
      toast({ type: 'error', message: 'Failed to set import mode.' });
    }
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
      <div style={{ fontWeight: 700, color: '#00bfff', marginBottom: 8, fontSize: '1.2rem' }}>
        Current Import Mode: {importMode}
      </div>
      <strong>This setting changes how Cliparr handles automatically importing and scanning shows</strong><br/><br/>
      <div style={{ marginBottom: '2rem', color: '#b0b8c1', fontSize: '1.1rem', lineHeight: 1.6 }}>
        <strong>Import Modes:</strong><br/>
        <b>None</b>: Requires manual import and manual selection for audio fingerprint analysis.<br/>
        <b>Import</b>: Will automatically schedule audio fingerprint analysis for shows you import. Will also periodically scan for new episodes for shows you have imported and schedule audio fingerprint analysis.<br/>
        <b>Auto</b>: Will sync all shows automatically and run fingerprint analysis. No changes to your data will be made. Will also scan for updates to media and perform audio analysis.
      </div>
      <div style={{ marginBottom: '2rem' }}>
        <label htmlFor="import-mode-select" style={{ fontWeight: 700, marginRight: 12 }}>Import Mode:</label>
        <select id="import-mode-select" value={importMode} onChange={handleModeChange} style={{ fontSize: '1.1rem', padding: '0.5rem 1.5rem', borderRadius: 4 }}>
          <option value="none">None (default)</option>
          <option value="import">Imported Only</option>
          <option value="auto">Auto </option>
        </select>
      </div>
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