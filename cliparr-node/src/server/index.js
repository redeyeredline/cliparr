import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeDatabase } from './db/init.js';
import dbRoutes from './routes/db.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 8484;

// Middleware
app.use(cors());
app.use(express.json());

// Permissive Content Security Policy for internal-only use
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; object-src 'none'; connect-src 'self' ws://localhost:8484 ws://127.0.0.1:8484;"
  );
  next();
});

// API Routes
app.use('/api/db', dbRoutes);

// Always serve static files
const distPath = join(__dirname, '../../dist');
app.use(express.static(distPath));

// Handle SPA routing
app.get('*', (req, res) => {
  res.sendFile(join(distPath, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Initialize database before starting server
async function startServer() {
  try {
    await initializeDatabase();
    app.listen(port, () => {
      logger.info(`Server running on port ${port}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
