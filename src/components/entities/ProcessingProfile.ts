export interface ProcessingProfile {
  id?: string | number;
  name: string;
  description?: string;
  video_codec: 'h264' | 'h265' | 'av1' | 'copy';
  audio_codec: 'aac' | 'ac3' | 'copy';
  container: 'mp4' | 'mkv' | 'avi';
  quality_preset:
    | 'ultrafast'
    | 'superfast'
    | 'veryfast'
    | 'faster'
    | 'fast'
    | 'medium'
    | 'slow'
    | 'slower'
    | 'veryslow';
  hardware_acceleration: 'none' | 'nvidia_nvenc' | 'intel_qsv' | 'amd_vce' | 'vaapi';
  target_bitrate: number;
  max_resolution: '480p' | '720p' | '1080p' | '1440p' | '4k' | 'original';
}
