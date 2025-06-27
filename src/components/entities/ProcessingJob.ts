export interface ProcessingJob {
  id?: string | number;
  media_file_id: string | number;
  profile_id?: string | number;
  status: 'detected' | 'verified' | 'processing' | 'completed' | 'failed' | 'scanning';
  confidence_score: number;
  intro_start?: number;
  intro_end?: number;
  credits_start?: number;
  credits_end?: number;
  manual_verified?: boolean;
  processing_notes?: string;
  created_date: string;
  updated_date?: string;
}

export class ProcessingJobEntity {
  static async list(sortBy?: string, limit?: number): Promise<ProcessingJob[]> {
    // TODO: Implement actual API call
    return [];
  }

  static async update(id: string | number, data: Partial<ProcessingJob>): Promise<void> {
    // TODO: Implement actual API call
    console.log('Updating job', id, data);
  }
}
