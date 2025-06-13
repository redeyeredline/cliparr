import { useEffect, useState } from 'react';
import { Spin, Table, Button, message } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';

function LogFiles() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch('/api/logs');
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch logs');
        }
        const data = await response.json();
        setLogs(data.files || []);
      } catch (error) {
        setError(error.message);
        message.error(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const columns = [
    {
      title: 'Filename',
      dataIndex: 'name',
      key: 'name',
      render: (text) => (
        <span style={{ color: '#e0e6ed' }}>
          <FileTextOutlined style={{ marginRight: 8 }} />
          {text}
        </span>
      )
    },
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
      render: (size) => {
        const kb = size / 1024;
        return <span style={{ color: '#888' }}>{kb.toFixed(1)} KB</span>;
      }
    },
    {
      title: 'Last Modified',
      dataIndex: 'modified',
      key: 'modified',
      render: (date) => (
        <span style={{ color: '#888' }}>
          {new Date(date).toLocaleString()}
        </span>
      )
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button
          type="primary"
          href={`/api/logs/${encodeURIComponent(record.name)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open
        </Button>
      )
    }
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Spin size="large" tip="Loading logs..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '2rem', color: '#e0e6ed' }}>Log Files</h1>
      
      {error ? (
        <div style={{ color: '#ff4d4f', marginBottom: '1rem' }}>{error}</div>
      ) : (
        <Table
          columns={columns}
          dataSource={logs}
          rowKey="name"
          pagination={false}
          style={{ background: 'transparent' }}
        />
      )}
    </div>
  );
}

export default LogFiles; 