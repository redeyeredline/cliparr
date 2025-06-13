import { useEffect, useState, useRef } from 'react';
import { Modal, Table, Button, Spin, message } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';

const ImportModal = ({ visible, onClose, onSuccess }) => {
  const [shows, setShows] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const modalRef = useRef();

  useEffect(() => {
    if (visible) {
      fetchShows();
    }
  }, [visible]);

  const fetchShows = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/shows/unimported');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch unimported shows');
      }
      const data = await response.json();
      setShows(data);
    } catch (error) {
      message.error(error.message);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (selected.length === 0) return;
    
    setImporting(true);
    try {
      const response = await fetch('/api/shows/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showIds: selected })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to import shows');
      }

      const data = await response.json();
      message.success(`Successfully imported ${selected.length} show${selected.length > 1 ? 's' : ''}`);
      onSuccess(data);
      onClose();
    } catch (error) {
      message.error(error.message);
    } finally {
      setImporting(false);
    }
  };

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (text) => <span style={{ color: '#e0e6ed' }}>{text}</span>
    },
    {
      title: 'Seasons',
      dataIndex: 'seasons',
      key: 'seasons',
      render: (seasons) => <span style={{ color: '#888' }}>{seasons?.length || 0}</span>
    },
    {
      title: 'Episodes',
      dataIndex: 'statistics',
      key: 'episodes',
      render: (stats) => <span style={{ color: '#888' }}>{stats?.episodeFileCount || 0}</span>
    },
    {
      title: 'Path',
      dataIndex: 'path',
      key: 'path',
      render: (text) => <span style={{ color: '#888' }}>{text}</span>
    }
  ];

  const rowSelection = {
    selectedRowKeys: selected,
    onChange: (selectedRowKeys) => setSelected(selectedRowKeys)
  };

  return (
    <Modal
      title="Import Shows"
      open={visible}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="cancel" onClick={onClose} icon={<CloseOutlined />}>
          Cancel
        </Button>,
        <Button
          key="import"
          type="primary"
          onClick={handleImport}
          loading={importing}
          disabled={selected.length === 0}
          icon={<CheckOutlined />}
        >
          Import Selected
        </Button>
      ]}
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <Spin size="large" tip="Loading shows..." />
        </div>
      ) : (
        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={shows}
          rowKey="id"
          pagination={false}
          scroll={{ y: 400 }}
          style={{ background: 'transparent' }}
        />
      )}
    </Modal>
  );
};

export default ImportModal; 