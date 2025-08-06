// Utility for filtering jobs by category/status
import { ProcessingJob } from '@/components/entities/all';

export type JobCategory = 'processing' | 'pending' | 'verified' | 'completed' | 'failed' | 'all' | 'queued';

export function filterJobsByCategory(
  jobs: ProcessingJob[],
  category: JobCategory,
): ProcessingJob[] {
  switch (category) {
    case 'processing':
      return jobs.filter((j) => j.status === 'processing');
    case 'queued':
      // Show jobs that are detected, verified, or scanning (not running, completed, or failed)
      return jobs.filter((j) => j.status === 'detected' || j.status === 'verified' || j.status === 'scanning');
    case 'pending':
      return jobs.filter((j) => j.status === 'detected' && !j.manual_verified);
    case 'verified':
      return jobs.filter((j) => j.manual_verified && j.status !== 'completed');
    case 'completed':
      return jobs.filter((j) => j.status === 'completed');
    case 'failed':
      return jobs.filter((j) => j.status === 'failed');
    case 'all':
    default:
      return jobs;
  }
}
