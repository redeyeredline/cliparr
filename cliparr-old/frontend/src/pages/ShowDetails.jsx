import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Collapse, Table, Button } from 'antd';
import { UpOutlined } from '@ant-design/icons';

function ShowDetails() {
  const { id } = useParams();
  const [show, setShow] = useState(null);
  const [error, setError] = useState('');
  const [activeKeys, setActiveKeys] = useState([]);

  useEffect(() => {
    fetch(`/api/series/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('Show not found');
        return res.json();
      })
      .then(data => setShow(data))
      .catch(e => setError(e.message));
  }, [id]);

  if (error) return <div style={{ color: 'red', padding: '2rem' }}>Error: {error}</div>;
  if (!show) return <div style={{ color: '#e0e6ed', padding: '2rem' }}>Loading...</div>;
  if (!Array.isArray(show.seasons) || show.seasons.length === 0) {
    return <div style={{ color: '#e0e6ed', padding: '2rem' }}>No seasons found for this show.</div>;
  }

  // Use string keys for Collapse
  const allKeys = show.seasons.map(season => String(season.seasonNumber));

  const handlePanelChange = (keys) => {
    setActiveKeys(Array.isArray(keys) ? keys : [keys]);
  };

  const handleCollapseSeason = (seasonNumber) => {
    setActiveKeys(keys => keys.filter(k => k !== String(seasonNumber)));
  };

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        width: '100%',
        height: '100%',
        color: '#e0e6ed',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        padding: '1.5rem 2.5rem 2.5rem 2.5rem',
        margin: 0,
      }}
    >
      <h1 style={{
        marginBottom: 24,
        fontSize: 32,
        fontWeight: 700,
        lineHeight: 1.1,
        wordBreak: 'break-word',
        marginTop: 0,
        marginLeft: 0,
        marginRight: 0,
      }}>
        {show.title}
      </h1>
      <Collapse
        activeKey={activeKeys}
        onChange={handlePanelChange}
        style={{ width: '100%', margin: 0, border: 'none' }}
      >
        {show.seasons.map((season, idx) => {
          // Filter out blank/invalid episodes
          const filteredEpisodes = (season.episodes || []).filter(
            ep => ep && ep.episodeNumber && ep.title && String(ep.title).trim() !== ''
          );
          return (
            <Collapse.Panel 
              header={`Season ${season.seasonNumber}`}
              key={season.seasonNumber}
              style={{ 
                margin: 0, 
                border: 'none', 
                padding: 0, 
                marginBottom: idx !== show.seasons.length - 1 ? '28px' : 0 // Add spacing between panels
              }}
            >
              <Table
                rowKey="episodeNumber"
                dataSource={filteredEpisodes}
                pagination={false}
                columns={[
                  { title: '#', dataIndex: 'episodeNumber', width: 60 },
                  { title: 'Title', dataIndex: 'title' },
                  { title: 'Audio Fingerprint', dataIndex: 'audioFingerprint', render: val => val || <i style={{ color: '#888' }}>Not linked</i> },
                  { title: 'Preview', render: (_, ep) => <Button size="small">Preview</Button> },
                ]}
                size="small"
                style={{ background: '#23272b', width: '100%', border: 'none', margin: 0, boxShadow: 'none' }}
                scroll={{ x: true }}
              />
              <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0 0 0' }}>
                <Button
                  icon={<UpOutlined />}
                  size="small"
                  style={{ background: '#232b36', color: '#fff', border: 'none', borderRadius: 4, boxShadow: 'none' }}
                  onClick={() => handleCollapseSeason(season.seasonNumber)}
                  aria-label="Collapse"
                />
              </div>
            </Collapse.Panel>
          );
        })}
      </Collapse>
    </div>
  );
}

export default ShowDetails; 