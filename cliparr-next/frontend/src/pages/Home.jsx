import { useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { Table, Button, Spin } from 'antd';
import { useToast } from '../components/ToastProvider';
import 'antd/dist/reset.css';
import { Link } from 'react-router-dom';

const Home = forwardRef(({ importedShows, activeLetter }, ref) => {
  const [selectionModel, setSelectionModel] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
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
      const response = await fetch('/api/shows/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showIds: selectionModel })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove show(s)');
      }
      toast({ type: 'success', message: `Removed ${selectionModel.length} show${selectionModel.length > 1 ? 's' : ''}.` });
      window.location.reload(); // Refresh to update the list
    } catch (error) {
      toast({ type: 'error', message: error.message || 'Failed to remove show(s).' });
    }
    setDeleting(false);
  };

  const columns = [
    {
      title: 'Series Title',
      dataIndex: 'title',
      key: 'title',
      sorter: (a, b) => a.title.localeCompare(b.title),
      render: (text, record) => (
        <Link to={`/show/${record.id}`} style={{
          color: '#00bfff',
          textDecoration: 'none',
          transition: 'color 0.2s',
          ':hover': {
            color: '#fff'
          }
        }}>{text}</Link>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys: selectionModel,
    onChange: setSelectionModel,
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Spin size="large" tip="Loading shows..." />
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 0, width: '100%', padding: '1rem' }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={importedShows}
          rowSelection={rowSelection}
          pagination={false}
          style={{ background: '#181818' }}
          className="custom-table"
        />
      </div>

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
          borderTop: '1px solid #23272b' 
        }}>
          <Button
            onClick={handleDelete}
            disabled={deleting}
            type="primary"
            danger
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      )}
    </div>
  );
});

export default Home; 