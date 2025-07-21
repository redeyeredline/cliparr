// Frontend WebSocket client for real-time communication with backend server.
// Provides connection management, automatic reconnection, and event listener system.
import { logger } from './logger.frontend.js';

class WebSocketClient {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.baseReconnectDelay = 2000; // 2s
    this.maxReconnectDelay = 60000; // 60s
    this.isConnecting = false;
    this.lastConnectionState = null;
    this.reconnectTimeout = null;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      // Use relative path for WebSocket
      this.ws = new WebSocket('/ws');

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }
        if (this.lastConnectionState !== 'connected') {
          this.lastConnectionState = 'connected';
          this.notifyListeners('connection', { status: 'connected' });
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Only log errors, not all messages
          if (data.type === 'job_update' && data.status === 'error') {
            // Suppress expected errors that occur during job deletion
            if (
              data.error &&
              (data.error.includes('could not renew lock') ||
                data.error.includes('Missing key for job') ||
                data.error.includes('not found'))
            ) {
              // Don't log these expected errors
              return;
            }

            logger.warn('[WebSocketClient] Job error received:', {
              type: data.type,
              jobId: data.jobId,
              dbJobId: data.dbJobId,
              status: data.status,
              error: data.error,
            });
          }

          this.notifyListeners('message', data);
        } catch (error) {
          logger.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        logger.error('[WebSocketClient] WebSocket error:', error);
        this.notifyListeners('error', error);
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        if (this.lastConnectionState !== 'disconnected') {
          this.lastConnectionState = 'disconnected';
          this.notifyListeners('connection', { status: 'disconnected' });
        }
        // Exponential backoff with jitter for reconnection
        this.reconnectAttempts++;
        const expDelay = Math.min(
          this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
          this.maxReconnectDelay,
        );
        // Add jitter: random between 0.5x and 1.5x of expDelay
        const jitter = expDelay * (0.5 + Math.random());
        this.reconnectTimeout = setTimeout(() => this.connect(), jitter);
      };
    } catch (error) {
      logger.error('[WebSocketClient] Failed to create WebSocket connection:', error);
      this.isConnecting = false;
      this.notifyListeners('error', error);
      // Try reconnecting with backoff
      this.reconnectAttempts++;
      const expDelay = Math.min(
        this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
        this.maxReconnectDelay,
      );
      const jitter = expDelay * (0.5 + Math.random());
      this.reconnectTimeout = setTimeout(() => this.connect(), jitter);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnecting = false;
      this.lastConnectionState = null;
    }
  }

  addEventListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  removeEventListener(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  notifyListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((callback) => callback(data));
    }
  }

  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      logger.warn('[WebSocketClient] Cannot send message, not connected');
    }
  }
}

// Create a singleton instance
const wsClient = new WebSocketClient();

export { wsClient };
