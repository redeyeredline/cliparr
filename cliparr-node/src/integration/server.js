// src/integration/index.js - Main backend server initialization
const express = require('express');
const path = require('path');
const pino = require('pino');
const { WebSocketServer } = require('ws');

// Import your existing database setup
const { getDatabaseSingleton } = require('../database/Auto_DB_Setup');

// Import API route modules
const healthRoutes = require('../routes/health');
const showRoutes = require('../routes/shows');

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

let serverInstance = null;
let wsServer = null;
let db = null;

// Setup WebSocket server
function setupWebSocket() {
  wsServer = new WebSocketServer({ server: serverInstance });
  
  wsServer.on('connection', (ws) => {
    logger.info('New WebSocket connection');
    
    ws.on('message', (message) => {
      logger.info('Received WebSocket message:', message.toString());
      ws.send(JSON.stringify({ 
        type: 'echo', 
        data: message.toString(),
        timestamp: new Date().toISOString()
      }));
    });
    
    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
    });

    ws.on('close', () => {
      logger.info('WebSocket connection closed');
    });
    
    ws.send(JSON.stringify({ 
      type: 'welcome', 
      message: 'Connected to Cliparr backend',
      timestamp: new Date().toISOString()
    }));
  });

  logger.info('✅ WebSocket server initialized');
}

async function startServer() {
  if (serverInstance) {
    logger.warn('Backend server already running');
    return serverInstance;
  }

  try {
    logger.info('🚀 Starting integrated backend server...');
    const app = express();
    const port = 8485;
    const host = '127.0.0.1';

    // Database initialization
    const dbPath = path.join(__dirname, '../database/data/cliparr.db');
    logger.info(`Database path: ${dbPath}`);
    db = getDatabaseSingleton(dbPath);
    
    // Make database available to routes
    app.set('db', db);
    app.set('logger', logger);
    
    // Middleware
    app.use(express.json());
    
    // CORS for development
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', 'http://localhost:8484');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      res.header('Access-Control-Allow-Credentials', 'true');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });
    
    // Mount API route modules
    app.use('/health', healthRoutes);
    app.use('/shows', showRoutes);

    // Start HTTP server
    serverInstance = app.listen(port, host, () => {
      logger.info(`✅ Backend server running on ${host}:${port}`);
      logger.info(`📊 Database ready at: ${dbPath}`);
      logger.info(`🔗 Proxied through Vite dev server`);
    });

    // Setup WebSocket after server starts
    setupWebSocket();

    return serverInstance;

  } catch (error) {
    logger.error('Failed to start backend server:', error);
    throw error;
  }
}

// Graceful shutdown
function stopServer() {
  if (wsServer) {
    wsServer.close();
    logger.info('WebSocket server closed');
  }
  
  if (serverInstance) {
    serverInstance.close();
    logger.info('Backend server closed');
  }
  
  serverInstance = null;
  wsServer = null;
  db = null;
}

// CommonJS exports
module.exports = {
  startServer,
  stopServer
};

// For direct execution
if (require.main === module) {
  startServer().catch(err => {
    logger.fatal('Failed to start server:', err);
    process.exit(1);
  });
}