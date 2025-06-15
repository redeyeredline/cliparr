const express = require('express');
const path = require('path');
const pino = require('pino');
const { WebSocketServer } = require('ws');
const { getDatabaseSingleton } = require('../database/Auto_DB_Setup');

// Initialize logger
const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

const app = express();
const port = process.env.PORT || 8484;

// Initialize WebSocket server
const wss = new WebSocketServer({ noServer: true });

// Initialize database
const dbPath = path.join(__dirname, '../../data/cliparr.db');
const db = getDatabaseSingleton(dbPath);

/*// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../dist')));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
*/

// Basic health check endpoint
app.get('/api/health', (req, res) => {
  logger.info('Health check requested');
  try {
    res.json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({ 
      status: 'error',
      message: error.message 
    });
  }
});

// Database test endpoint
app.get('/api/db-test', (req, res) => {
  try {
    // Test database connection and basic operations
    const testResult = db.transaction(() => {
      // Test settings table
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
        .run('test_key', 'test_value');
      
      const result = db.prepare('SELECT value FROM settings WHERE key = ?')
        .get('test_key');
      
      return {
        success: true,
        message: 'Database test successful',
        testValue: result?.value
      };
    })();

    res.json(testResult);
  } catch (error) {
    logger.error('Database test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Database test failed',
      error: error.message
    });
  }
});

// WebSocket connection handler
wss.on('connection', (ws) => {
  logger.info('New WebSocket connection');
  
  ws.on('message', (message) => {
    logger.info('Received message:', message.toString());
    });
    
    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
      });
      });
      
      // Start server
      const server = app.listen(port, '0.0.0.0', () => {
        logger.info(`Server running on port ${port}`);
        });
        
{/*
// Handle WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});
*/
/*
// Handle server errors
server.on('error', (error) => {
  logger.error('Server error:', error);
}); */}