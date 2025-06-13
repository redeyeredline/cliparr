import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Collapse, Table, Button, Spin, message } from 'antd';
import { UpOutlined, ArrowLeftOutlined } from '@ant-design/icons';

function ShowDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [show, setShow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeKeys, setActiveKeys] = useState([]);

  useEffect(() => {
    const fetchShow = async () => {
      try {
        const response = await fetch(`/api/shows/${id}`);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Show not found');
        }
        const data = await response.json();
        setShow(data);
      } catch (error) {
        setError(error.message);
        message.error(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchShow();
  }, [id]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Spin size="large" tip="Loading show details..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', color: '#ff4d4f' }}>
        <div style={{ marginBottom: '1rem' }}>Error: {error}</div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
          Back to Shows
        </Button>
      </div>
    );
  }

  if (!show || !Array.isArray(show.seasons) || show.seasons.length === 0) {
    return (
      <div style={{ padding: '2rem', color: '#e0e6ed' }}>
        <div style={{ marginBottom: '1rem' }}>No seasons found for this show.</div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
          Back to Shows
        </Button>
      </div>
    );
  }

  const handlePanelChange = (keys) => {
    setActiveKeys(Array.isArray(keys) ? keys : [keys]);
  };

  const handleCollapseSeason = (seasonNumber) => {
    setActiveKeys(keys => keys.filter(k => k !== String(seasonNumber)));
  };

  return (
    <div style={{ padding: '2rem', color: '#e0e6ed' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/')}
          style={{ marginBottom: '1rem' }}
        >
          Back to Shows
        </Button>
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold' }}>{show.title}</h1>
      </div>

      <Collapse
        activeKey={activeKeys}
        onChange={handlePanelChange}
        style={{ background: 'transparent' }}
      >
        {show.seasons.map((season, idx) => {
          const filteredEpisodes = (season.episodes || []).filter(
            ep => ep && ep.episodeNumber && ep.title && String(ep.title).trim() !== ''
          );

          return (
            <Collapse.Panel 
              header={`Season ${season.seasonNumber}`}
              key={String(season.seasonNumber)}
              style={{ 
                marginBottom: idx !== show.seasons.length - 1 ? '1rem' : 0,
                background: '#23272b',
                border: 'none'
              }}
            >
              <Table
                rowKey="episodeNumber"
                dataSource={filteredEpisodes}
                pagination={false}
                columns={[
                  { 
                    title: '#', 
                    dataIndex: 'episodeNumber', 
                    width: 60,
                    render: (text) => <span style={{ color: '#00bfff' }}>{text}</span>
                  },
                  { 
                    title: 'Title', 
                    dataIndex: 'title',
                    render: (text) => <span style={{ color: '#e0e6ed' }}>{text}</span>
                  },
                  { 
                    title: 'Audio Fingerprint', 
                    dataIndex: 'audioFingerprint',
                    render: (val) => val || <span style={{ color: '#888', fontStyle: 'italic' }}>Not linked</span>
                  },
                  {
                    title: 'Preview',
                    render: (_, ep) => (
                      <Button 
                        size="small"
                        type="primary"
                        onClick={() => {
                          // TODO: Implement preview functionality
                          message.info('Preview functionality coming soon');
                        }}
                      >
                        Preview
                      </Button>
                    )
                  }
                ]}
                style={{ background: 'transparent' }}
              />
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                <Button
                  icon={<UpOutlined />}
                  size="small"
                  onClick={() => handleCollapseSeason(season.seasonNumber)}
                >
                  Collapse
                </Button>
              </div>
            </Collapse.Panel>
          );
        })}
      </Collapse>
    </div>
  );
}

export default ShowDetails; 