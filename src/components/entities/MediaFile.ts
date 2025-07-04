import { api } from '../../integration/api-client';

export interface MediaFile {
  id?: string | number;
  file_name: string;
  file_path: string;
  file_size: number;
  duration?: number;
  series_name?: string;
  season?: number;
  episode?: number;
  episode_id?: string | number;
  created_date: string;
  updated_date?: string;
}

export class MediaFileEntity {
  static async list(sortBy?: string, limit?: number): Promise<MediaFile[]> {
    try {
      const response = await api.get('/processing/media-files');
      return response.data.files || [];
    } catch (error) {
      console.error('Error fetching media files:', error);
      return [];
    }
  }

  static async getById(id: string | number): Promise<MediaFile | null> {
    try {
      const response = await api.get(`/media/files/${id}`);
      return response.data.file || null;
    } catch (error) {
      console.error('Error fetching media file:', error);
      return null;
    }
  }

  static async getByEpisodeId(episodeId: string | number): Promise<MediaFile[]> {
    try {
      const response = await api.get(`/media/files/episode/${episodeId}`);
      return response.data.files || [];
    } catch (error) {
      console.error('Error fetching media files for episode:', error);
      return [];
    }
  }
}
