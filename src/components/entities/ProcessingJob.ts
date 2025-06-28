import { api } from '../../integration/api-client';

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
  static async list(sortBy?: string): Promise<ProcessingJob[]> {
    try {
      const response = await api.get(`/api/processing/jobs?sortBy=${sortBy || '-created_date'}`);
      return response.data.jobs || [];
    } catch (error) {
      console.error('Error fetching processing jobs:', error);
      return [];
    }
  }

  static async update(id: string | number, data: Partial<ProcessingJob>): Promise<void> {
    try {
      await api.put(`/api/processing/jobs/${id}`, data);
    } catch (error) {
      console.error('Error updating processing job:', error);
      throw error;
    }
  }

  static async getById(id: string | number): Promise<ProcessingJob | null> {
    try {
      const response = await api.get(`/api/processing/jobs/${id}`);
      return response.data.job || null;
    } catch (error) {
      console.error('Error fetching processing job:', error);
      return null;
    }
  }

  static async delete(id: string | number): Promise<void> {
    try {
      await api.delete(`/api/processing/jobs/${id}`);
    } catch (error) {
      console.error('Error deleting processing job:', error);
      throw error;
    }
  }

  static async getAllIds(status?: string): Promise<(string | number)[]> {
    try {
      let url = '/api/processing/jobs/ids';
      if (status && status !== 'all') {
        url += `?status=${encodeURIComponent(status)}`;
      }
      const response = await api.get(url);
      return response.data.ids || [];
    } catch (error) {
      console.error('Error fetching all processing job IDs:', error);
      return [];
    }
  }
}
