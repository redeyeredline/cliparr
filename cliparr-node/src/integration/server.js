// src/integration/server.js - Main backend server initialization
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../services/logger.js';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import http from 'http';

// Load environment variables
dotenv.config();

// Import your existing database setup
import { getDatabaseSingleton } from '../database/Auto_DB_Setup.js';

// Import API route modules
import healthRoutes from '../routes/health.js';
import showRoutes from '../routes/shows.js';
import sonarrRoutes from '../routes/sonarr.js';
import settingsRoutes from '../routes/settings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Validate required environment variables
const requiredEnvVars = ['SONARR_API_KEY'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  logger.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

let serverInstance = null;
let wsServer = null;
let db = null;

// Function to check if port is in use
async function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.once('error', () => {
      resolve(true);
    });
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

// Setup WebSocket server
function setupWebSocket(server) {
  wsServer = new WebSocketServer({ server, path: '/ws' });
  
  wsServer.on('connection', (ws) => {
    logger.debug('New WebSocket connection');
    
    ws.on('message', (message) => {
      logger.debug('WebSocket message received');
      ws.send(JSON.stringify({ 
        type: 'echo', 
        data: message.toString(),
        timestamp: new Date().toISOString()
      }));
    });
    
    ws.on('error', (error) => {
      logger.error({ error: error.message }, 'WebSocket error');
    });

    ws.on('close', () => {
      logger.debug('WebSocket connection closed');
    });
    
    ws.send(JSON.stringify({ 
      type: 'welcome', 
      message: 'Connected to Cliparr backend',
      timestamp: new Date().toISOString()
    }));
  });

  logger.info('WebSocket server initialized');
}

// Get WebSocket server instance
export function getWebSocketServer() {
  return wsServer;
}

async function startServer() {
  if (serverInstance) {
    logger.warn('Server already running');
    return serverInstance;
  }

  try {
    logger.info('Starting backend server...');
    const app = express();
    const port = 8485;
    const host = '0.0.0.0';

    // Check if port is in use
    const portInUse = await isPortInUse(port);
    if (portInUse) {
      logger.error(`Port ${port} is already in use`);
      throw new Error(`Port ${port} is already in use. Please stop any existing server instances.`);
    }

    // Database initialization
    const dbPath = path.join(__dirname, '../database/data/cliparr.db');
    db = getDatabaseSingleton(dbPath);
    
    // Make database and WebSocket server available to routes
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
    app.use('/sonarr', sonarrRoutes);
    app.use('/settings', settingsRoutes);

    logger.info('Settings routes registered at /settings');

    // Create HTTP server
    serverInstance = http.createServer(app);

    // Setup WebSocket after server starts
    setupWebSocket(serverInstance);
    
    // Make WebSocket server available to routes
    app.set('wss', wsServer);

    // Start server
    serverInstance.listen(port, host, () => {
      logger.info(`Server running on ${host}:${port}`);
    });

    // Handle server errors
    serverInstance.on('error', (error) => {
      logger.error({ error: error.message }, 'Server error');
      stopServer();
    });

    return serverInstance;

  } catch (error) {
    logger.error({ error: error.message }, 'Server startup failed');
    await stopServer();
    throw error;
  }
}

// Graceful shutdown
async function stopServer() {
  return new Promise((resolve) => {
    if (wsServer) {
      wsServer.close(() => {
        logger.info('WebSocket server closed');
        wsServer = null;
      });
    }
    
    if (serverInstance) {
      serverInstance.close(() => {
        logger.info('Server closed');
        serverInstance = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

// Handle process termination
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await stopServer();
  process.exit(0);
});

process.on('SIGINT', () => {
  if (db) db.close();
  if (serverInstance) serverInstance.close();
  if (wsServer) wsServer.close();
  process.exit(0);
});

// ES Module exports
export {
  startServer,
  stopServer
};

// For direct execution
if (process.argv[1] === new URL(import.meta.url).pathname) {
  startServer().catch(err => {
    logger.fatal('Failed to start server:', err);
    process.exit(1);
  });
}