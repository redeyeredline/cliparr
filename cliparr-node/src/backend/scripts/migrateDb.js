const sqlite3 = require('sqlite3').verbose();
const { pool } = require('../db');
const path = require('path');

async function migrateDatabase() {
  const oldDbPath = path.join(__dirname, '../../../../cliparr-old/data/cliparr.db');
  const oldDb = new sqlite3.Database(oldDbPath);

  const client = await pool.connect();

  try {
    // Start transaction
    await client.query('BEGIN');

    // Migrate shows
    const shows = await new Promise((resolve, reject) => {
      oldDb.all('SELECT * FROM shows', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    for (const show of shows) {
      await client.query(
        'INSERT INTO shows (sonarr_id, title, overview, path) VALUES ($1, $2, $3, $4) ON CONFLICT (sonarr_id) DO NOTHING',
        [show.sonarr_id, show.title, show.overview, show.path]
      );
    }

    // Migrate seasons
    const seasons = await new Promise((resolve, reject) => {
      oldDb.all('SELECT * FROM seasons', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    for (const season of seasons) {
      await client.query(
        'INSERT INTO seasons (show_id, season_number) VALUES ($1, $2) ON CONFLICT (show_id, season_number) DO NOTHING',
        [season.show_id, season.season_number]
      );
    }

    // Migrate episodes
    const episodes = await new Promise((resolve, reject) => {
      oldDb.all('SELECT * FROM episodes', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    for (const episode of episodes) {
      await client.query(
        'INSERT INTO episodes (season_id, episode_number, title, sonarr_episode_id) VALUES ($1, $2, $3, $4) ON CONFLICT (sonarr_episode_id) DO NOTHING',
        [episode.season_id, episode.episode_number, episode.title, episode.sonarr_episode_id]
      );
    }

    // Migrate episode files
    const episodeFiles = await new Promise((resolve, reject) => {
      oldDb.all('SELECT * FROM episode_files', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    for (const file of episodeFiles) {
      await client.query(
        'INSERT INTO episode_files (episode_id, file_path, size, quality) VALUES ($1, $2, $3, $4)',
        [file.episode_id, file.file_path, file.size, file.quality]
      );
    }

    // Migrate settings
    const settings = await new Promise((resolve, reject) => {
      oldDb.all('SELECT * FROM settings', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    for (const setting of settings) {
      await client.query(
        'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
        [setting.key, setting.value]
      );
    }

    // Commit transaction
    await client.query('COMMIT');
    console.log('Database migration completed successfully');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during migration:', error);
    throw error;
  } finally {
    client.release();
    oldDb.close();
  }
}

// Run migration
migrateDatabase().catch(console.error); 