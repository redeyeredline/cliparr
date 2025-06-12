import React, { useEffect, useState, useImperativeHandle, forwardRef, useRef } from 'react';
import { Table, Button } from 'antd';
import { useToast } from '../components/ToastProvider';
import 'antd/dist/reset.css';
import { Link } from 'react-router-dom';

const Home = forwardRef(({ importedShows, setImportedShowsLoaded }, ref) => {
  const [selectionModel, setSelectionModel] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const tableBodyRef = useRef();
  const toast = useToast();

  useImperativeHandle(ref, () => ({
    scrollToLetter: (letter) => {
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
    }
  }));

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
      setImportedShowsLoaded(false); // refetch imported shows
      setSelectionModel([]);
    } catch (e) {
      toast({ type: 'error', message: 'Failed to remove show(s).' });
    }
    setDeleting(false);
  };

  const columns = [
    {
      title: 'Series Title',
      dataIndex: 'title',
      key: 'title',
      sorter: (a, b) => a.title.localeCompare(b.title),
      render: (text, record) => <Link to={`/series/${record.id}`}>{text}</Link>,
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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Static Top Bar */}
      <div style={{ 
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

      {/* Main Table Area */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          flex: 1,
          minHeight: 0,
          width: '100%',
          padding: '1rem',
          borderRadius: '4px',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto'
        }}>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={importedShows}
            rowSelection={rowSelection}
            pagination={false}
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