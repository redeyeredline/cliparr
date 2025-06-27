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
