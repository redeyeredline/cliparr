import { Router } from 'express';
import { sonarrService } from '../services/sonarrService';

const router = Router();

// Get all series from Sonarr
router.get('/series', async (req, res) => {
  try {
    const series = await sonarrService.fetchSeries();
    res.json(series);
  } catch (error) {
    console.error('Error fetching series:', error);
    res.status(500).json({ error: 'Failed to fetch series from Sonarr' });
  }
});

// Get episodes for a specific series
router.get('/series/:id/episodes', async (req, res) => {
  try {
    const seriesId = parseInt(req.params.id);
    const episodes = await sonarrService.fetchEpisodes(seriesId);
    res.json(episodes);
  } catch (error) {
    console.error(`Error fetching episodes for series ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch episodes from Sonarr' });
  }
});

// Get episode files for a specific series
router.get('/series/:id/files', async (req, res) => {
  try {
    const seriesId = parseInt(req.params.id);
    const files = await sonarrService.fetchEpisodeFiles(seriesId);
    res.json(files);
  } catch (error) {
    console.error(`Error fetching episode files for series ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch episode files from Sonarr' });
  }
});

export default router;
