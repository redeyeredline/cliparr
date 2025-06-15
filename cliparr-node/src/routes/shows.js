// src/integration/routes/shows.js - Shows API routes
import express from 'express';
const router = express.Router();

// Get shows with pagination
router.get('/', (req, res) => {
  const db = req.app.get('db');
  const logger = req.app.get('logger');

  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;

    logger.info(`Fetching shows: page=${page}, pageSize=${pageSize}`);

    const query = `
      SELECT 
        s.id, 
        s.title, 
        s.path, 
        s.sonarr_id,
        s.status,
        s.overview,
        s.added_at,
        COUNT(DISTINCT e.id) as episode_count
      FROM shows s
      LEFT JOIN seasons se ON se.show_id = s.id
      LEFT JOIN episodes e ON e.season_id = se.id
      GROUP BY s.id, s.title, s.path, s.sonarr_id, s.status, s.overview, s.added_at
      ORDER BY s.title
      LIMIT ? OFFSET ?
    `;

    const offset = (page - 1) * pageSize;
    const shows = db.prepare(query).all(pageSize, offset);

    const totalQuery = 'SELECT COUNT(*) as total FROM shows';
    const total = db.prepare(totalQuery).get().total;

    logger.info(`Found ${shows.length} shows out of ${total} total`);

    res.json({
      shows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    logger.error('Failed to fetch shows:', error);
    res.status(500).json({
      error: 'Failed to fetch shows',
      message: error.message,
    });
  }
});

// Create new show
router.post('/', (req, res) => {
  const db = req.app.get('db');
  const logger = req.app.get('logger');

  try {
    const { title, path: showPath, overview, sonarr_id, status } = req.body;

    logger.info(`Creating show: ${title}`);

    const insertStmt = db.prepare(`
      INSERT INTO shows (title, path, overview, sonarr_id, status)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(title, showPath, overview, sonarr_id, status);

    logger.info(`Show created with ID: ${result.lastInsertRowid}`);

    res.json({
      success: true,
      id: result.lastInsertRowid,
      message: 'Show created successfully',
    });
  } catch (error) {
    logger.error('Failed to create show:', error);
    res.status(500).json({
      error: 'Failed to create show',
      message: error.message,
    });
  }
});

// Get specific show by ID
router.get('/:id', (req, res) => {
  const db = req.app.get('db');
  const logger = req.app.get('logger');

  try {
    const showId = parseInt(req.params.id);

    if (isNaN(showId)) {
      return res.status(400).json({ error: 'Invalid show ID' });
    }

    const query = `
      SELECT 
        s.id, 
        s.title, 
        s.path, 
        s.sonarr_id,
        s.status,
        s.overview,
        s.added_at
      FROM shows s
      WHERE s.id = ?
    `;

    const show = db.prepare(query).get(showId);

    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }

    logger.info(`Retrieved show: ${show.title}`);
    res.json(show);
  } catch (error) {
    logger.error('Failed to fetch show:', error);
    res.status(500).json({
      error: 'Failed to fetch show',
      message: error.message,
    });
  }
});

// Update show
router.put('/:id', (req, res) => {
  const db = req.app.get('db');
  const logger = req.app.get('logger');

  try {
    const showId = parseInt(req.params.id);
    const { title, path: showPath, overview, sonarr_id, status } = req.body;

    if (isNaN(showId)) {
      return res.status(400).json({ error: 'Invalid show ID' });
    }

    const updateStmt = db.prepare(`
      UPDATE shows 
      SET title = ?, path = ?, overview = ?, sonarr_id = ?, status = ?
      WHERE id = ?
    `);

    const result = updateStmt.run(title, showPath, overview, sonarr_id, status, showId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Show not found' });
    }

    logger.info(`Updated show ID: ${showId}`);
    res.json({
      success: true,
      message: 'Show updated successfully',
    });
  } catch (error) {
    logger.error('Failed to update show:', error);
    res.status(500).json({
      error: 'Failed to update show',
      message: error.message,
    });
  }
});

// Delete show
router.delete('/:id', (req, res) => {
  const db = req.app.get('db');
  const logger = req.app.get('logger');

  try {
    const showId = parseInt(req.params.id);

    if (isNaN(showId)) {
      return res.status(400).json({ error: 'Invalid show ID' });
    }

    const deleteStmt = db.prepare('DELETE FROM shows WHERE id = ?');
    const result = deleteStmt.run(showId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Show not found' });
    }

    logger.info(`Deleted show ID: ${showId}`);
    res.json({
      success: true,
      message: 'Show deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete show:', error);
    res.status(500).json({
      error: 'Failed to delete show',
      message: error.message,
    });
  }
});

export default router;
