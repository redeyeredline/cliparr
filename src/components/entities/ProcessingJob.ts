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
    try {
      const response = await fetch(`/api/processing/jobs?sortBy=${sortBy || '-created_date'}&limit=${limit || 100}`);
      if (!response.ok) {
        throw new Error('Failed to fetch processing jobs');
      }
      const data = await response.json();
      return data.jobs || [];
    } catch (error) {
      console.error('Error fetching processing jobs:', error);
      return [];
    }
  }

  static async update(id: string | number, data: Partial<ProcessingJob>): Promise<void> {
    try {
      const response = await fetch(`/api/processing/jobs/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to update processing job');
      }
    } catch (error) {
      console.error('Error updating processing job:', error);
      throw error;
    }
  }

  static async getById(id: string | number): Promise<ProcessingJob | null> {
    try {
      const response = await fetch(`/api/processing/jobs/${id}`);
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      return data.job || null;
    } catch (error) {
      console.error('Error fetching processing job:', error);
      return null;
    }
  }
}
