import { logger } from './logger.frontend.js';

class WebSocketClient {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      logger.debug('WebSocket already connected');
      return;
    }

    try {
      this.ws = new WebSocket('ws://localhost:8485/ws');

      this.ws.onopen = () => {
        logger.info('WebSocket connected');
        this.reconnectAttempts = 0;
        this.notifyListeners('connection', { status: 'connected' });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.notifyListeners('message', data);
        } catch (error) {
          logger.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        logger.error('WebSocket error:', error);
        this.notifyListeners('error', error);
      };

      this.ws.onclose = () => {
        logger.info('WebSocket disconnected');
        this.notifyListeners('connection', { status: 'disconnected' });

        // Attempt to reconnect if not at max attempts
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          setTimeout(() => this.connect(), this.reconnectDelay);
        }
      };
    } catch (error) {
      logger.error('Failed to create WebSocket connection:', error);
      this.notifyListeners('error', error);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
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
      logger.warn('WebSocket not connected, cannot send message');
    }
  }
}

// Create a singleton instance
const wsClient = new WebSocketClient();

export { wsClient };
