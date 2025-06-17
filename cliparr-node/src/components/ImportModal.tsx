import { useEffect, useState, useRef } from 'react';

interface Season {
  seasonNumber: number;
}

interface ShowStatistics {
  episodeFileCount: number;
}

export interface Show {
  id: number;
  title: string;
  path: string;
}

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (selectedIds: number[]) => void;
  shows: Show[];
  loading?: boolean;
  error?: string | null;
}

const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  background: 'rgba(0, 0, 0, 0.75)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
} as const;

const modalStyle = {
  background: '#1a1a1a',
  borderRadius: '12px',
  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.5)',
  padding: '2rem',
  width: '90%',
  maxWidth: '1200px',
  height: '80vh',
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  color: '#ffffff',
} as const;

const closeButtonStyle = {
  position: 'absolute',
  top: '16px',
  right: '16px',
  fontSize: '1.5rem',
  color: '#ffffff',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px 8px',
  borderRadius: '4px',
  transition: 'background-color 0.2s',
} as const;

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  marginTop: '1rem',
} as const;

const thStyle = {
  textAlign: 'left',
  padding: '12px',
  borderBottom: '2px solid #333',
  color: '#ffffff',
  fontWeight: '600',
} as const;

const tdStyle = {
  padding: '12px',
  borderBottom: '1px solid #333',
  color: '#ffffff',
} as const;

const checkboxStyle = {
  width: '18px',
  height: '18px',
  cursor: 'pointer',
} as const;

const buttonStyle = {
  padding: '8px 16px',
  borderRadius: '6px',
  border: 'none',
  cursor: 'pointer',
  fontWeight: '600',
  transition: 'all 0.2s',
} as const;

const primaryButtonStyle = {
  ...buttonStyle,
  background: '#2563eb',
  color: 'white',
} as const;

const secondaryButtonStyle = {
  ...buttonStyle,
  background: '#374151',
  color: 'white',
} as const;

const loadingSkeletonStyle = {
  background: '#2a2a2a',
  borderRadius: '4px',
  height: '24px',
  margin: '8px 0',
  animation: 'pulse 1.5s infinite',
} as const;

const selectAllContainerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginBottom: '1rem',
  padding: '8px',
  background: '#2a2a2a',
  borderRadius: '6px',
} as const;

export default function ImportModal({
  open,
  onClose,
  onImport,
  shows,
  loading = false,
  error = null,
}: ImportModalProps) {
  const [selected, setSelected] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelected([]);
    setSelectAll(false);
  }, [shows, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  const handleToggle = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id],
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
      <div ref={modalRef} style={modalStyle}>
        <button
          style={closeButtonStyle}
          onClick={onClose}
          aria-label="Close"
          onMouseOver={(e) => (e.currentTarget.style.background = '#333')}
          onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          ×
        </button>
        <h2 style={{ marginTop: 0, color: '#ffffff', fontSize: '1.5rem' }}>Import Shows</h2>
        {error && (
          <div style={{ color: '#f87171', marginBottom: '1rem', padding: '8px', background: '#7f1d1d', borderRadius: '4px' }}>
            {error}
          </div>
        )}
        {loading ? (
          <div style={{ flex: 1, overflow: 'auto' }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={loadingSkeletonStyle} />
            ))}
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <table className="min-w-full divide-y divide-gray-700" style={tableStyle}>
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 w-12 text-center align-middle">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        aria-label="Select all shows"
                        className="align-middle"
                        style={checkboxStyle}
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Path</th>
                  </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {shows.map((show) => (
                    <tr key={show.id}>
                      <td className="px-4 py-2 w-12 text-center align-middle">
                        <input
                          type="checkbox"
                          checked={selected.includes(show.id)}
                          onChange={() => handleToggle(show.id)}
                          aria-label={`Select show ${show.title}`}
                          className="align-middle"
                          style={checkboxStyle}
                        />
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap" style={tdStyle}>{show.title}</td>
                      <td className="px-6 py-2 whitespace-nowrap" style={tdStyle}>{show.path}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '1rem',
              marginTop: '1rem',
              paddingTop: '1rem',
              borderTop: '1px solid #333',
            }}>
              <button
                onClick={handleOk}
                disabled={selected.length === 0}
                style={{
                  ...primaryButtonStyle,
                  opacity: selected.length === 0 ? 0.5 : 1,
                  cursor: selected.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                Import Selected ({selected.length})
              </button>
              <button
                onClick={onClose}
                style={secondaryButtonStyle}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
