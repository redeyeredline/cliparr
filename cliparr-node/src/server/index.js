const express = require('express');
const path = require('path');
const pino = require('pino');
const { WebSocketServer } = require('ws');

// Initialize logger first - this should never fail
const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

// Comprehensive server initialization with step-by-step validation
async function initializeServer() {
  let app = null;
  let db = null;
  let wss = null;
  let server = null;
  
  try {
    logger.info('🚀 Starting server initialization...');
    
    // Step 1: Initialize Express app
    logger.info('📦 Step 1: Initializing Express app...');
    app = express();
    if (!app) {
      throw new Error('Failed to create Express app');
    }
    logger.info('✅ Express app created successfully');
    
    // Step 2: Set up port with validation
    logger.info('🔌 Step 2: Configuring port...');
    const port = process.env.PORT || 8484;
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error(`Invalid port number: ${port}`);
    }
    logger.info(`✅ Port configured: ${port}`);
    
    // Step 3: Initialize database
    logger.info('🗄️  Step 3: Initializing database...');
    try {
      const { getDatabaseSingleton } = require('../database/Auto_DB_Setup');
      const dbPath = path.join(__dirname, '../../data/cliparr.db');
      const resolvedPath = path.resolve(dbPath);
      
      logger.info(`Database path: ${resolvedPath}`);
      
      // Check if directory exists or can be created
      const dbDir = path.dirname(resolvedPath);
      const fs = require('fs');
      if (!fs.existsSync(dbDir)) {
        logger.info(`Creating database directory: ${dbDir}`);
        fs.mkdirSync(dbDir, { recursive: true });
      }
      
      db = getDatabaseSingleton(dbPath);
      if (!db) {
        throw new Error('Database connection returned null');
      }
      
      // Test database with a simple query
      const testResult = db.prepare('SELECT 1 as test').get();
      if (!testResult || testResult.test !== 1) {
        throw new Error('Database test query failed');
      }
      
      logger.info('✅ Database initialized and tested successfully');
    } catch (dbError) {
      throw new Error(`Database initialization failed: ${dbError.message}`);
    }
    
    // Step 4: Configure middleware
    logger.info('🔧 Step 4: Setting up middleware...');
    try {
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
      
      logger.info('✅ Middleware configured successfully');
    } catch (middlewareError) {
      throw new Error(`Middleware setup failed: ${middlewareError.message}`);
    }
    
    // Step 5: Set up routes
    logger.info('🛣️  Step 5: Setting up routes...');
    try {
      // Health check endpoint
      app.get('/api/health', (req, res) => {
        logger.info('Health check requested');
        res.json({ 
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          database: 'connected'
        });
      });
      
      // Database test endpoint
      app.get('/api/db-test', (req, res) => {
        try {
          const testResult = db.transaction(() => {
            db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
              .run('test_key', 'test_value');
            
            const result = db.prepare('SELECT value FROM settings WHERE key = ?')
              .get('test_key');
            
            return {
              success: true,
              message: 'Database test successful',
              testValue: result?.value,
              timestamp: new Date().toISOString()
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
      
      logger.info('✅ Routes configured successfully');
    } catch (routeError) {
      throw new Error(`Route setup failed: ${routeError.message}`);
    }
    
    // Step 6: Initialize WebSocket server
    logger.info('🔗 Step 6: Initializing WebSocket server...');
    try {
      wss = new WebSocketServer({ noServer: true });
      if (!wss) {
        throw new Error('Failed to create WebSocket server');
      }
      
      wss.on('connection', (ws) => {
        logger.info('New WebSocket connection established');
        
        ws.on('message', (message) => {
          logger.info('Received WebSocket message:', message.toString());
        });
        
        ws.on('error', (error) => {
          logger.error('WebSocket connection error:', error);
        });
        
        ws.on('close', () => {
          logger.info('WebSocket connection closed');
        });
      });
      
      logger.info('✅ WebSocket server initialized successfully');
    } catch (wsError) {
      throw new Error(`WebSocket initialization failed: ${wsError.message}`);
    }
    
    // Step 7: Start HTTP server
    logger.info('🌐 Step 7: Starting HTTP server...');
    try {
      server = await new Promise((resolve, reject) => {
        const httpServer = app.listen(port, '0.0.0.0', () => {
          resolve(httpServer);
        });
        
        httpServer.on('error', (error) => {
          if (error.code === 'EADDRINUSE') {
            reject(new Error(`Port ${port} is already in use. Kill the process using: sudo lsof -ti:${port} | xargs kill -9`));
          } else if (error.code === 'EACCES') {
            reject(new Error(`Permission denied on port ${port}. Try a port > 1024 or run with sudo`));
          } else {
            reject(new Error(`Server error: ${error.message}`));
          }
        });
      });
      
      if (!server || !server.listening) {
        throw new Error('Server failed to start listening');
      }
      
      logger.info('✅ HTTP server started successfully');
    } catch (serverError) {
      throw new Error(`HTTP server startup failed: ${serverError.message}`);
    }
    
    // Step 8: Set up WebSocket upgrade handling
    logger.info('🔄 Step 8: Setting up WebSocket upgrades...');
    try {
      server.on('upgrade', (request, socket, head) => {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      });
      logger.info('✅ WebSocket upgrade handling configured');
    } catch (upgradeError) {
      throw new Error(`WebSocket upgrade setup failed: ${upgradeError.message}`);
    }
    
    // Step 9: Set up graceful shutdown handlers
    logger.info('🛡️  Step 9: Setting up graceful shutdown...');
    const gracefulShutdown = (signal) => {
      logger.info(`${signal} received, shutting down gracefully...`);
      
      if (server) {
        server.close(() => {
          logger.info('HTTP server closed');
        });
      }
      
      if (wss) {
        wss.close(() => {
          logger.info('WebSocket server closed');
        });
      }
      
      if (db) {
        db.close();
        logger.info('Database connection closed');
      }
      
      logger.info('Graceful shutdown complete');
      process.exit(0);
    };
    
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.fatal('Uncaught exception:', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.fatal('Unhandled rejection at:', promise, 'reason:', reason);
      gracefulShutdown('UNHANDLED_REJECTION');
    });
    
    logger.info('✅ Graceful shutdown handlers configured');
    
    // 🎉 ALL SYSTEMS GO!
    logger.info('🎉 SERVER INITIALIZATION COMPLETE!');
    logger.info(`🌟 Server is running on port ${port}`);
    logger.info(`🔗 Health check: http://localhost:${port}/api/health`);
    logger.info(`🗄️  Database test: http://localhost:${port}/api/db-test`);
    logger.info('💰 Everything is cash money! 💰');
    
    return { app, db, wss, server, port };
    
  } catch (error) {
    // 💥 Something went wrong - clean up and exit
    logger.fatal('❌ SERVER INITIALIZATION FAILED:', error.message);
    
    // Clean up any resources that were created
    if (server) {
      try {
        server.close();
        logger.info('Closed HTTP server during cleanup');
      } catch (e) {
        logger.error('Error closing server:', e.message);
      }
    }
    
    if (wss) {
      try {
        wss.close();
        logger.info('Closed WebSocket server during cleanup');
      } catch (e) {
        logger.error('Error closing WebSocket server:', e.message);
      }
    }
    
    if (db) {
      try {
        db.close();
        logger.info('Closed database connection during cleanup');
      } catch (e) {
        logger.error('Error closing database:', e.message);
      }
    }
    
    logger.fatal('Server startup aborted. Check the error above and fix the issue.');
    process.exit(1);
  }
}

// Start the server initialization
initializeServer().catch((error) => {
  logger.fatal('Unexpected error during server initialization:', error);
  process.exit(1);
});