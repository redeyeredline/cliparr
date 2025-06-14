import { Router } from 'express';
import { showModel } from '../models/shows';
import { seasonModel } from '../models/seasons';
import { episodeModel } from '../models/episodes';
import { episodeFileModel } from '../models/episodeFiles';
import { isDatabaseInitialized } from '../models/initDb';

const router = Router();

router.get('/test', async (req, res) => {
  try {
    // Check if database is initialized
    const isInitialized = await isDatabaseInitialized();
    if (!isInitialized) {
      return res.status(500).json({
        status: 'error',
        message: 'Database not initialized',
      });
    }

    // Test show insertion
    const showId = await showModel.insertShow({
      sonarr_id: 999999,
      title: 'Test Show',
      overview: 'Test Overview',
      path: '/test/path',
    });

    // Test season insertion
    const seasonId = await seasonModel.insertSeason(showId, 1);

    // Test episode insertion
    const episodeId = await episodeModel.insertEpisode({
      season_id: seasonId,
      episode_number: 1,
      title: 'Test Episode',
      sonarr_episode_id: 999999,
    });

    // Test episode file insertion
    const fileId = await episodeFileModel.insertEpisodeFile({
      episode_id: episodeId,
      file_path: '/test/file.mkv',
      size: 1000000,
      quality: '1080p',
    });

    // Verify all insertions
    const show = await showModel.getShowById(showId);
    const season = await seasonModel.getSeasonById(seasonId);
    const episode = await episodeModel.getEpisodeById(episodeId);
    const file = await episodeFileModel.getEpisodeFileByEpisodeId(episodeId);

    // Clean up test data
    await showModel.deleteShow(showId);

    res.json({
      status: 'success',
      message: 'Database operations test completed successfully',
      data: {
        show,
        season,
        episode,
        file,
      },
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Database test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
