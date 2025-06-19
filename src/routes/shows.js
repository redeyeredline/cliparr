// src/integration/routes/shows.js - Shows API routes
import express from 'express';
const router = express.Router();

// Get all shows
router.get('/', (req, res) => {
  const db = req.app.get('db');
  const logger = req.app.get('logger');

  try {
    logger.info('Fetching all shows');

    const query = `
      SELECT 
        s.id, 
        s.title, 
        s.path
      FROM shows s
    `;

    const shows = db.prepare(query).all();
    const total = shows.length;

    logger.info(`Found ${shows.length} shows in local database`);

    res.json({
      shows,
      total,
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
    const { title, path: showPath } = req.body;

    logger.info(`Creating show: ${title}`);

    const insertStmt = db.prepare(`
      INSERT INTO shows (title, path)
      VALUES (?, ?)
    `);

    const result = insertStmt.run(title, showPath);

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
        s.path
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
    const { title, path: showPath } = req.body;

    if (isNaN(showId)) {
      return res.status(400).json({ error: 'Invalid show ID' });
    }

    const updateStmt = db.prepare(`
      UPDATE shows 
      SET title = ?, path = ?
      WHERE id = ?
    `);

    const result = updateStmt.run(title, showPath, showId);

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

// Batch delete shows (cascade: episode_files, episodes, seasons, shows)
router.post('/delete', (req, res) => {
  const db = req.app.get('db');
  const logger = req.app.get('logger');
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids must be a non-empty array' });
  }
  try {
    db.transaction(() => {
      // Get all episode IDs for the shows
      const episodeRows = db.prepare(
        `SELECT e.id FROM episodes e JOIN seasons s ON e.season_id = s.id WHERE s.show_id IN (${ids.map(() => '?').join(',')})`,
      ).all(...ids);
      const episodeIds = episodeRows.map((row) => row.id);
      if (episodeIds.length > 0) {
        db.prepare(`DELETE FROM episode_files WHERE episode_id IN (${episodeIds.map(() => '?').join(',')})`).run(...episodeIds);
      }
      // Only run if there are seasons for these shows
      const seasonRows = db.prepare(
        `SELECT id FROM seasons WHERE show_id IN (${ids.map(() => '?').join(',')})`,
      ).all(...ids);
      const seasonIds = seasonRows.map((row) => row.id);
      if (seasonIds.length > 0) {
        db.prepare(`DELETE FROM episodes WHERE season_id IN (${seasonIds.map(() => '?').join(',')})`).run(...seasonIds);
      }
      if (ids.length > 0) {
        db.prepare(`DELETE FROM seasons WHERE show_id IN (${ids.map(() => '?').join(',')})`).run(...ids);
        db.prepare(`DELETE FROM shows WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
      }
    })();
    logger.info(`Cascade deleted shows and related data for IDs: ${ids}`);
    res.json({ success: true, deleted: ids.length });
  } catch (error) {
    logger.error('Failed to cascade delete shows:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to cascade delete shows', message: error.message, stack: error.stack });
  }
});

export default router;
