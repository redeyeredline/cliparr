import { logger } from '../services/logger.js';
import { getDb, getImportMode, getPollingInterval } from '../database/Db_Operations.js';

export class ImportTaskManager {
  constructor(wss) {
    this.wss = wss;
    this.taskInterval = null;
    this.isRunning = false;
    this.shutdownRequested = false;
  }

  start() {
    if (this.taskInterval) {
      logger.warn('Import task already running');
      return;
    }

    const db = getDb();
    const mode = getImportMode(db);

    // Don't start the task if mode is 'none'
    if (mode === 'none') {
      logger.info('Import mode is set to none, not starting import task');
      return;
    }

    const interval = getPollingInterval(db);
    logger.info(`Starting import task with ${interval}s interval`);

    // Run initial import immediately
    this.runTask(true);

    // Then set up periodic task
    this.taskInterval = setInterval(() => this.runTask(false), interval * 1000);
    this.isRunning = true;
  }

  async stop() {
    logger.info('Stopping import task...');
    this.shutdownRequested = true;

    // Clear the interval immediately
    if (this.taskInterval) {
      clearInterval(this.taskInterval);
      this.taskInterval = null;
    }

    // Wait for any running task to complete
    while (this.isRunning) {
      logger.info('Waiting for running import task to complete...');
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.isRunning = false;
    this.shutdownRequested = false;
    logger.info('Import task stopped');
  }

  updateInterval() {
    const db = getDb();
    const mode = getImportMode(db);
    const newInterval = getPollingInterval(db);

    // If mode is 'none', stop the task
    if (mode === 'none') {
      if (this.taskInterval) {
        clearInterval(this.taskInterval);
        this.taskInterval = null;
        logger.info('Import task stopped due to none mode');
      }
      return;
    }

    // Otherwise update the interval
    if (this.taskInterval) {
      clearInterval(this.taskInterval);
      this.taskInterval = setInterval(() => this.runTask(false), newInterval * 1000);
      logger.info(`Updated import task interval to ${newInterval}s`);
    } else {
      // If task was stopped (e.g. due to none mode), restart it
      this.start();
    }
  }

  broadcastStatus(status) {
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'import_status',
          ...status,
          timestamp: new Date().toISOString(),
        }));
      }
    });
  }

  async fetchFromSonarr(endpoint) {
    const response = await fetch(`${process.env.SONARR_URL}/api/v3/${endpoint}`, {
      headers: {
        'X-Api-Key': process.env.SONARR_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Sonarr API error: ${response.status}`);
    }

    return response.json();
  }

  async importShow(show, db) {
    try {
      // Get show details and episodes from Sonarr
      const [showDetails, episodes] = await Promise.all([
        this.fetchFromSonarr(`series/${show.id}`),
        this.fetchFromSonarr(`episode?seriesId=${show.id}`),
      ]);

      // Group episodes by season
      const seasons = {};
      episodes.forEach((episode) => {
        if (!seasons[episode.seasonNumber]) {
          seasons[episode.seasonNumber] = {
            seasonNumber: episode.seasonNumber,
            episodes: [],
          };
        }
        seasons[episode.seasonNumber].episodes.push(episode);
      });

      // Use a transaction for data consistency
      db.transaction(() => {
        // Insert or update the show
        const showResult = db.prepare(`
          INSERT OR REPLACE INTO shows (
            title, path
          ) VALUES (?, ?)
        `).run(
          showDetails.title,
          showDetails.path,
        );
        const dbShowId = showResult.lastInsertRowid;

        // Insert or update seasons and episodes
        Object.values(seasons).forEach((season) => {
          const seasonResult = db.prepare(`
            INSERT OR IGNORE INTO seasons (
              show_id, season_number
            ) VALUES (?, ?)
          `).run(
            dbShowId,
            season.seasonNumber,
          );

          season.episodes.forEach((episode) => {
            db.prepare(`
              INSERT OR REPLACE INTO episodes (
                season_id, episode_number, title
              ) VALUES (?, ?, ?)
            `).run(
              seasonResult.lastInsertRowid,
              episode.episodeNumber,
              episode.title,
            );
          });
        });
      })();

      logger.info(`Successfully imported show: ${showDetails.title}`);
      return true;
    } catch (error) {
      logger.error(`Failed to import show ${show.title}:`, error);
      return false;
    }
  }

  async runTask(isInitialRun = false) {
    if (this.isRunning) {
      logger.debug('Previous task still running, skipping');
      return;
    }

    try {
      this.isRunning = true;
      const db = getDb();

      const mode = getImportMode(db);
      logger.info(`Running import task in ${mode} mode (${isInitialRun ? 'initial run' : 'refresh'})`);

      this.broadcastStatus({
        status: 'running',
        mode,
        isInitialRun,
        timestamp: new Date().toISOString(),
      });

      if (this.shutdownRequested) {
        logger.info('Shutdown requested, skipping import task');
        return;
      }

      if (mode === 'auto' || (mode === 'import' && isInitialRun)) {
        // Get all shows from Sonarr
        const sonarrShows = await this.fetchFromSonarr('series');

        // Get currently imported shows
        const importedShows = db.prepare('SELECT title, path FROM shows').all();
        const importedSet = new Set(importedShows.map((show) => show.title + '|' + show.path));

        // Filter shows based on mode
        const showsToProcess = mode === 'auto'
          ? sonarrShows.filter((show) => !importedSet.has(show.title + '|' + show.path))
          : sonarrShows.filter((show) => importedSet.has(show.title + '|' + show.path));

        logger.info(`Found ${showsToProcess.length} shows to process in ${mode} mode`);

        // Process each show
        for (const show of showsToProcess) {
          await this.importShow(show, db);
        }
      } else if (mode === 'import' && !isInitialRun) {
        // In import mode, only check for new episodes in existing shows
        const importedShows = db.prepare('SELECT id, title FROM shows').all();

        for (const show of importedShows) {
          try {
            // Get episodes from Sonarr
            const sonarrEpisodes = await this.fetchFromSonarr(`episode?seriesId=${show.id}`);

            // Get current episodes from database
            const dbEpisodes = db.prepare(`
              SELECT e.episode_number, s.season_number
              FROM episodes e
              JOIN seasons s ON e.season_id = s.id
              WHERE s.show_id = ?
            `).all(show.id);

            const dbEpisodeSet = new Set(
              dbEpisodes.map((ep) => `${ep.season_number}|${ep.episode_number}`),
            );

            // Find new episodes
            const newEpisodes = sonarrEpisodes.filter(
              (ep) => !dbEpisodeSet.has(`${ep.seasonNumber}|${ep.episodeNumber}`),
            );

            if (newEpisodes.length > 0) {
              logger.info(`Found ${newEpisodes.length} new episodes for show: ${show.title}`);

              // Group new episodes by season
              const seasons = {};
              newEpisodes.forEach((episode) => {
                if (!seasons[episode.seasonNumber]) {
                  seasons[episode.seasonNumber] = {
                    seasonNumber: episode.seasonNumber,
                    episodes: [],
                  };
                }
                seasons[episode.seasonNumber].episodes.push(episode);
              });

              // Insert new episodes
              db.transaction(() => {
                Object.values(seasons).forEach((season) => {
                  const seasonResult = db.prepare(`
                    INSERT OR IGNORE INTO seasons (
                      show_id, season_number
                    ) VALUES (?, ?)
                  `).run(
                    show.id,
                    season.seasonNumber,
                  );

                  season.episodes.forEach((episode) => {
                    db.prepare(`
                      INSERT OR REPLACE INTO episodes (
                        season_id, episode_number, title
                      ) VALUES (?, ?, ?)
                    `).run(
                      seasonResult.lastInsertRowid,
                      episode.episodeNumber,
                      episode.title,
                    );
                  });
                });
              })();
            }
          } catch (error) {
            logger.error(`Failed to check for new episodes in show ${show.title}:`, error);
          }
        }
      }

      this.broadcastStatus({
        status: 'completed',
        mode,
        isInitialRun,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error in import task:', error);
      this.broadcastStatus({
        status: 'error',
        error: error.message,
        mode: getImportMode(db),
        isInitialRun,
        timestamp: new Date().toISOString(),
      });
    } finally {
      this.isRunning = false;
    }
  }
}
