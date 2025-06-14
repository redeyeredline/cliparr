import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const App: React.FC = () => {
  const [socket, setSocket] = useState<any>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [health, setHealth] = useState<{ status: string; timestamp: string } | null>(null);

  useEffect(() => {
    // Initialize Socket.IO connection
    const socketInstance = io();
    setSocket(socketInstance);

    // Socket event handlers
    socketInstance.on('connect', () => {
      setMessages(prev => [...prev, 'Connected to server']);
    });

    socketInstance.on('disconnect', () => {
      setMessages(prev => [...prev, 'Disconnected from server']);
    });

    socketInstance.on('test_response', (data) => {
      setMessages(prev => [...prev, `Received test response: ${JSON.stringify(data)}`]);
    });

    // Check server health
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setHealth(data))
      .catch(err => console.error('Health check failed:', err));

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const sendTestEvent = () => {
    if (socket) {
      socket.emit('test_event', { message: 'Hello from client!' });
      setMessages(prev => [...prev, 'Sent test event']);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Cliparr</h1>
        
        {/* Health Status */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Server Status</h2>
          {health ? (
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${health.status === 'ok' ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-gray-600">
                Server is {health.status} (Last checked: {new Date(health.timestamp).toLocaleTimeString()})
              </span>
            </div>
          ) : (
            <p className="text-gray-600">Checking server status...</p>
          )}
        </div>

        {/* WebSocket Test */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">WebSocket Test</h2>
          <button
            onClick={sendTestEvent}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded"
          >
            Send Test Event
          </button>
        </div>

        {/* Message Log */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Message Log</h2>
          <div className="bg-gray-50 rounded p-4 h-64 overflow-y-auto">
            {messages.map((msg, index) => (
              <div key={index} className="text-gray-600 mb-2">
                {msg}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App; 