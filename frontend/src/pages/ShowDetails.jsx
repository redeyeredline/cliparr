import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Collapse, Table, Button } from 'antd';

function ShowDetails() {
  const { id } = useParams();
  const [show, setShow] = useState(null);
  const [error, setError] = useState('');

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
      <Collapse accordion style={{ width: '100%', margin: 0 }}>
        {show.seasons.map(season => (
          <Collapse.Panel header={`Season ${season.seasonNumber}`} key={season.seasonNumber}>
            <Table
              rowKey="episodeNumber"
              dataSource={season.episodes || []}
              pagination={false}
              columns={[
                { title: '#', dataIndex: 'episodeNumber', width: 60 },
                { title: 'Title', dataIndex: 'title' },
                { title: 'Audio Fingerprint', dataIndex: 'audioFingerprint', render: val => val || <i style={{ color: '#888' }}>Not linked</i> },
                { title: 'Preview', render: (_, ep) => <Button size="small">Preview</Button> },
              ]}
              size="small"
              style={{ background: '#23272b', width: '100%' }}
              scroll={{ x: true }}
            />
          </Collapse.Panel>
        ))}
      </Collapse>
    </div>
  );
}

export default ShowDetails; 