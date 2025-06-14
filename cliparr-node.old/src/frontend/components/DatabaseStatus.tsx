import React, { useState, useEffect } from 'react';

const DatabaseStatus: React.FC = () => {
  const [status, setStatus] = useState<string>('checking');

  useEffect(() => {
    const checkDatabase = async () => {
      try {
        const response = await fetch('/api/db/test');
        if (!response.ok) {
          throw new Error('Database check failed');
        }
        setStatus('connected');
      } catch {
        setStatus('error');
      }
    };

    checkDatabase();
  }, []);

  return (
    <div>
      <h2>Database Status: {status}</h2>
    </div>
  );
};

export default DatabaseStatus;
