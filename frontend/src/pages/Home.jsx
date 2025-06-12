import React, { useEffect, useState, useImperativeHandle, forwardRef, useRef } from 'react';
import ImportModal from '../components/ImportModal';
import { Table, Button } from 'antd';
import { useToast } from '../components/ToastProvider';
import 'antd/dist/reset.css';

const Home = forwardRef(({ scrollToLetter }, ref) => {
  const [importedShows, setImportedShows] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalShows, setModalShows] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [selectionModel, setSelectionModel] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const tableBodyRef = useRef();
  const toast = useToast();

  useEffect(() => {
    fetch('/api/imported-shows')
      .then(res => res.json())
      .then(data => {
        setImportedShows(data);
      })
      .catch(() => {
      });
  }, []);

  useImperativeHandle(ref, () => ({
    scrollToLetter: (letter) => {
      // Select all visible table rows
      const rows = document.querySelectorAll('.ant-table-row');
      let matchIndex = -1;
      for (let i = 0; i < importedShows.length; i++) {
        const title = importedShows[i].title || '';
        if (letter === '#') {
          if (/^[^a-zA-Z]/.test(title)) {
            matchIndex = i;
            break;
          }
        } else {
          if (title.toUpperCase().startsWith(letter)) {
            matchIndex = i;
            break;
          }
        }
      }
      if (matchIndex !== -1 && rows[matchIndex]) {
        rows[matchIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    },
    openImportModal: () => {
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
    }
  }));

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
        toast({ type: 'success', message: `Successfully imported ${data.importedCount} shows.` });
        setImportMessage('');
        // Refresh imported shows
        fetch('/api/imported-shows')
          .then(res => res.json())
          .then(data => setImportedShows(data));
        setShowModal(false);
      } else {
        toast({ type: 'error', message: data.error || 'Import failed.' });
        setImportMessage('');
      }
    } catch (e) {
      toast({ type: 'error', message: 'Import failed.' });
      setImportMessage('');
    }
    setImporting(false);
  };

  const handleDelete = async () => {
    if (selectionModel.length === 0) return;
    setDeleting(true);
    try {
      await fetch('/api/imported-shows', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showIds: selectionModel })
      });
      toast({ type: 'success', message: `Removed ${selectionModel.length} show${selectionModel.length > 1 ? 's' : ''}.` });
      // Refresh imported shows
      fetch('/api/imported-shows')
        .then(res => res.json())
        .then(data => setImportedShows(data));
      setSelectionModel([]);
    } catch (e) {
      toast({ type: 'error', message: 'Failed to remove show(s).' });
      // Optionally show error
    }
    setDeleting(false);
  };

  const columns = [
    {
      title: 'Series Title',
      dataIndex: 'title',
      key: 'title',
      sorter: (a, b) => a.title.localeCompare(b.title),
      sortDirections: ['ascend', 'descend'],
    },
    {
      title: 'Path',
      dataIndex: 'path',
      key: 'path',
      ellipsis: true,
    },
    {
      title: 'Episodes (DB)',
      dataIndex: 'db_episode_count',
      key: 'db_episode_count',
      sorter: (a, b) => a.db_episode_count - b.db_episode_count,
    },
    {
      title: 'Episodes (Sonarr)',
      dataIndex: 'sonarr_episode_count',
      key: 'sonarr_episode_count',
      sorter: (a, b) => a.sonarr_episode_count - b.sonarr_episode_count,
    },
  ];

  const rowSelection = {
    selectedRowKeys: selectionModel,
    onChange: setSelectionModel,
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#181818' }}>
      {/* Static Top Bar */}
      <div style={{ 
        backgroundColor: '#222', 
        color: '#fff', 
        position: 'sticky', 
        top: 0, 
        zIndex: 100,
        padding: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        {/* Removed Import More Shows button from here */}
      </div>

      <ImportModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onImport={handleImport}
        shows={modalShows}
        loading={modalLoading || importing}
        error={modalError || importMessage}
      />

      {/* Main Table Area */}
      <div style={{ flex: 1, minHeight: 0, padding: '1rem', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          flex: 1,
          minHeight: 0,
          width: '100%',
          backgroundColor: '#222',
          padding: '1rem',
          borderRadius: '4px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={importedShows}
            rowSelection={rowSelection}
            pagination={false}
            style={{ backgroundColor: '#222', color: '#fff' }}
          />
        </div>
      </div>

      {/* Static Bottom Bar (appears when selection) */}
      {selectionModel.length > 0 && (
        <div style={{ 
          position: 'fixed', 
          bottom: 0, 
          left: 0, 
          width: '100%', 
          backgroundColor: '#181818', 
          padding: '1rem', 
          zIndex: 200, 
          display: 'flex', 
          justifyContent: 'flex-end', 
          borderTop: '1px solid #333' 
        }}>
          <Button
            onClick={handleDelete}
            disabled={deleting}
            style={{ 
              backgroundColor: '#dc3545',
              color: '#fff',
              border: 'none',
              padding: '0.5rem 2rem',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Delete
          </Button>
        </div>
      )}
    </div>
  );
});

export default Home; 