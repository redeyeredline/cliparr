import React, { useEffect, useState, useRef } from 'react';

const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  background: 'rgba(0,0,0,0.6)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const modalStyle = {
  background: '#222',
  borderRadius: '8px',
  boxShadow: '0 2px 16px rgba(0,0,0,0.4)',
  padding: '1.5rem',
  minWidth: '350px',
  maxWidth: '90vw',
  maxHeight: '80vh',
  overflow: 'auto',
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
};

const closeButtonStyle = {
  position: 'absolute',
  top: '10px',
  right: '16px',
  fontSize: '1.5rem',
  color: '#aaa',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
};

const tableStyle = {
  width: '100%',
  marginBottom: '1rem',
};

const ImportModal = ({ open, onClose, onImport, shows, loading, error }) => {
  const [selected, setSelected] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const modalRef = useRef();

  useEffect(() => {
    setSelected([]);
    setSelectAll(false);
  }, [shows, open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleOverlayClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      onClose();
    }
  };

  const handleToggle = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelected([]);
      setSelectAll(false);
    } else {
      setSelected(shows.map((show) => show.id));
      setSelectAll(true);
    }
  };

  const handleOk = () => {
    onImport(selected);
  };

  return (
    <div style={modalOverlayStyle} onMouseDown={handleOverlayClick}>
      <div ref={modalRef} style={{ ...modalStyle, minHeight: Math.min(400, 80 * (shows.length + 2)), maxHeight: '80vh' }}>
        <button style={closeButtonStyle} onClick={onClose} aria-label="Close">×</button>
        <h2 style={{ marginTop: 0 }}>Import Shows</h2>
        {error && <div style={{ color: 'orange', marginBottom: '1rem' }}>{error}</div>}
        {loading ? (
          <div>Loading...</div>
        ) : (
          <>
            <button onClick={handleSelectAll} style={{ marginBottom: '1rem' }}>
              {selectAll ? 'Unselect All' : 'Select All'}
            </button>
            <div style={{ overflowY: 'auto', maxHeight: '50vh' }}>
              <table style={tableStyle}>
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
                          onChange={() => handleToggle(show.id)}
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
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
              <button onClick={handleOk} disabled={selected.length === 0} style={{ fontWeight: 'bold' }}>OK</button>
              <button onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ImportModal; 