const express = require('express');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');
const http = require('http');
const { pool, initializeDatabase } = require('./db');
const sonarrAPI = require('./services/sonarr');
const importModeService = require('./services/importMode');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST"]
  }
});

const port = process.env.PORT || 8484;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
initializeDatabase().catch(console.error);

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected');
  socket.on('disconnect', () => console.log('Client disconnected'));
});

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Import Mode Routes
app.get('/api/settings/import-mode', async (req, res) => {
  try {
    const mode = await importModeService.getImportMode();
    res.json({ mode });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/settings/import-mode', async (req, res) => {
  try {
    const { mode } = req.body;
    const updatedMode = await importModeService.setImportMode(mode);
    res.json({ mode: updatedMode });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/imported-shows', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 100;
    const shows = await importModeService.getImportedShows(page, pageSize);
    res.json(shows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sonarr/import', async (req, res) => {
  try {
    const { sonarrIds } = req.body;
    const results = await Promise.all(
      sonarrIds.map(id => importModeService.importShow(id))
    );
    res.json({ success: true, imported: results });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/imported-shows', async (req, res) => {
  try {
    const { showIds } = req.body;
    await Promise.all(
      showIds.map(id => importModeService.deleteImportedShow(id))
    );
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Sonarr API Routes
app.get('/api/sonarr/series', async (req, res) => {
  try {
    const series = await sonarrAPI.fetchSeries();
    res.json(series);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sonarr/episodes/:seriesId', async (req, res) => {
  try {
    const episodes = await sonarrAPI.fetchEpisodes(req.params.seriesId);
    res.json(episodes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 