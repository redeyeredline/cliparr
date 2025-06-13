import io from 'socket.io-client';

export function testWebSocketConnection() {
  return new Promise((resolve, reject) => {
    const socket = io({
      path: '/socket.io',
      transports: ['websocket'],
      forceNew: true,
      timeout: 5000  // Increased timeout
    });

    const testTimeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error('WebSocket connection timed out'));
    }, 5000);

    socket.on('connect', () => {
      clearTimeout(testTimeout);
      socket.emit('test_event', { timestamp: Date.now() });
    });

    socket.on('test_event_response', (response) => {
      clearTimeout(testTimeout);
      socket.disconnect();
      resolve({
        status: 'success',
        serverTimestamp: response.serverTimestamp,
        latency: Date.now() - response.clientTimestamp
      });
    });

    socket.on('connect_error', (error) => {
      clearTimeout(testTimeout);
      socket.disconnect();
      reject(new Error(`WebSocket connection error: ${error.message}`));
    });
  });
}

export function diagnoseWebSocketIssues() {
  return new Promise((resolve) => {
    try {
      const browserSupport = 'WebSocket' in window;
      const connectionProtocol = window.location.protocol === 'https:' ? 'Secure (HTTPS)' : 'Insecure (HTTP)';

      // Detailed network diagnostics
      const networkInfo = {
        connectionType: navigator.connection?.effectiveType || 'unknown',
        downlinkSpeed: navigator.connection?.downlink || 'unknown',
        rtt: navigator.connection?.rtt || 'unknown'
      };

      testWebSocketConnection()
        .then(results => {
          resolve({
            browserSupport,
            connectionProtocol,
            networkInfo,
            status: 'success',
            ...results
          });
        })
        .catch(error => {
          resolve({
            browserSupport,
            connectionProtocol,
            networkInfo,
            error: error.message
          });
        });
    } catch (error) {
      resolve({
        error: error.message
      });
    }
  });
}

// Automatically run diagnostics on import
diagnoseWebSocketIssues().then(results => {
  console.log('WebSocket Diagnostics:', JSON.stringify(results, null, 2));
}).catch(error => {
  console.error('WebSocket Diagnostics Error:', error);
}); 