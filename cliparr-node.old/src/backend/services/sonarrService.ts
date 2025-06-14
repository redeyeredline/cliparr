import axios, { AxiosError } from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';

// TypeScript interfaces for Sonarr API responses
export interface SonarrSeries {
  id: number;
  title: string;
  path: string;
  tvdbId: number;
  tvMazeId: number;
  imdbId: string;
  type: string;
  seasonFolder: boolean;
  monitored: boolean;
  useSceneNumbering: boolean;
  runtime: number;
  airTime: string;
  certification: string;
  network: string;
  overview: string;
  lastInfoSync: string;
  seriesType: string;
  cleanTitle: string;
  status: string;
  images: Array<{
    coverType: string;
    url: string;
  }>;
  seasons: Array<{
    seasonNumber: number;
    monitored: boolean;
  }>;
  year: number;
  firstAired: string;
  qualityProfileId: number;
  languageProfileId: number;
  rootFolderPath: string;
}

export interface SonarrEpisode {
  id: number;
  seriesId: number;
  episodeFileId: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  airDate: string;
  airDateUtc: string;
  overview: string;
  hasFile: boolean;
  monitored: boolean;
  unverifiedSceneNumbering: boolean;
  lastSearchTime: string;
  downloadId: string;
  downloadClient: string;
  downloadClientEpisodeId: string;
  grabDate: string;
  series: SonarrSeries;
  episodeFile: {
    seriesId: number;
    seasonNumber: number;
    relativePath: string;
    path: string;
    size: number;
    dateAdded: string;
    sceneName: string;
    quality: {
      quality: {
        id: number;
        name: string;
      };
      revision: {
        version: number;
        real: number;
        isRepack: boolean;
      };
    };
    mediaInfo: {
      audioChannels: number;
      audioCodec: string;
      audioLanguages: string[];
      audioStreamCount: number;
      videoBitDepth: number;
      videoBitrate: number;
      videoCodec: string;
      videoFps: number;
      resolution: string;
      runTime: string;
      scanType: string;
      subtitles: string[];
    };
  };
}

export interface SonarrEpisodeFile {
  id: number;
  seriesId: number;
  seasonNumber: number;
  relativePath: string;
  path: string;
  size: number;
  dateAdded: string;
  sceneName: string;
  quality: {
    quality: {
      id: number;
      name: string;
    };
    revision: {
      version: number;
      real: number;
      isRepack: boolean;
    };
  };
  mediaInfo: {
    audioChannels: number;
    audioCodec: string;
    audioLanguages: string[];
    audioStreamCount: number;
    videoBitDepth: number;
    videoBitrate: number;
    videoCodec: string;
    videoFps: number;
    resolution: string;
    runTime: string;
    scanType: string;
    subtitles: string[];
  };
}

class SonarrService {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.sonarr.url;
    this.apiKey = config.sonarr.apiKey;
  }

  private get headers() {
    return {
      'X-Api-Key': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  private handleError(error: unknown, context: string): never {
    if (error instanceof AxiosError) {
      logger.error(`Sonarr API error in ${context}:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });
      throw new Error(`Sonarr API error: ${error.response?.statusText || error.message}`);
    }
    logger.error(`Unexpected error in ${context}:`, error);
    throw error;
  }

  async fetchSeries(): Promise<SonarrSeries[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v3/series`, {
        headers: this.headers,
      });
      return response.data;
    } catch (error) {
      this.handleError(error, 'fetchSeries');
    }
  }

  async fetchEpisodes(seriesId: number): Promise<SonarrEpisode[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v3/episode?seriesId=${seriesId}`, {
        headers: this.headers,
      });
      return response.data;
    } catch (error) {
      this.handleError(error, `fetchEpisodes for series ${seriesId}`);
    }
  }

  async fetchEpisodeFiles(seriesId: number): Promise<SonarrEpisodeFile[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v3/episodefile?seriesId=${seriesId}`, {
        headers: this.headers,
      });
      return response.data;
    } catch (error) {
      this.handleError(error, `fetchEpisodeFiles for series ${seriesId}`);
    }
  }
}

export const sonarrService = new SonarrService();
