import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Play,
  Pause,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileVideo,
  List,
  Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProcessingJob, MediaFile, ProcessingProfile } from '../entities/all';
import { ProcessingJobEntity } from '../entities/ProcessingJob';

interface ProcessingQueueProps {
  jobs: ProcessingJob[];
  mediaFiles: MediaFile[];
  profiles: ProcessingProfile[];
  onStopProcessing: (jobId: string | number) => Promise<void>;
  isLoading: boolean;
  onDeleteJob: (jobId: string | number) => Promise<void>;
  selected: (string | number)[];
  setSelected: (ids: (string | number)[]) => void;
  onBulkDelete?: () => Promise<void>;
  bulkDeleteLoading?: boolean;
}

export default function ProcessingQueue({
  jobs,
  mediaFiles,
  profiles,
  onStopProcessing,
  isLoading,
  onDeleteJob,
  selected,
  setSelected,
  onBulkDelete,
  bulkDeleteLoading,
}: ProcessingQueueProps) {
  const [filter, setFilter] = useState<string>('all');
  const [selectAllLoading, setSelectAllLoading] = useState(false);
  const [allJobIds, setAllJobIds] = useState<(string | number)[]>([]);
  const filteredJobs = jobs.filter((job) => filter === 'all' || job.status === filter);

  // Fetch all job IDs for the current filter
  useEffect(() => {
    const fetchAllJobIds = async () => {
      setSelectAllLoading(true);
      try {
        const ids = await ProcessingJobEntity.getAllIds(filter === 'all' ? undefined : filter);
        setAllJobIds(ids);
      } catch (error) {
        console.error('Error fetching all job IDs:', error);
        // Fallback to using filtered jobs
        setAllJobIds(filteredJobs.map((job) => job.id!));
      } finally {
        setSelectAllLoading(false);
      }
    };

    fetchAllJobIds();
  }, [filter, jobs]);

  const getMediaFile = (mediaFileId: string | number): MediaFile | undefined => {
    return mediaFiles.find((f) => f.id === mediaFileId);
  };

  const statusConfig = {
    processing: { color: 'bg-blue-100 text-blue-700', icon: Play },
    verified: { color: 'bg-amber-100 text-amber-700', icon: Clock },
    completed: { color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    failed: { color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  };

  // Selection logic - now based on allJobIds instead of filteredJobs
  const allSelected = allJobIds.length > 0 && selected.length === allJobIds.length;
  const handleSelectAll = async () => {
    if (allSelected) {
      setSelected([]);
    } else {
      setSelected([...allJobIds]);
    }
  };

  const handleRowSelect = (jobId: string | number) => {
    if (selected.includes(jobId)) {
      setSelected(selected.filter((id) => id !== jobId));
    } else {
      setSelected([...selected, jobId]);
    }
  };

  return (
    <Card className="border-0 rounded-2xl shadow-lg bg-slate-800/90 backdrop-blur-md flex flex-col min-h-0">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-white">
              <List className="w-5 h-5" />
              Job Queue
            </CardTitle>
            <div className="flex items-center gap-2 ml-4">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleSelectAll}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2 transition-all duration-200"
                id="select-all-jobs"
                disabled={selectAllLoading}
              />
              {selectAllLoading && (
                <span className="text-xs text-blue-400 animate-pulse ml-1">Loading all…</span>
              )}
              <label htmlFor="select-all-jobs" className="text-slate-200 text-xs">
                Select all
              </label>
            </div>
            {selected.length > 0 && onBulkDelete && (
              <div className="flex items-center gap-2 ml-4">
                <span className="text-xs text-slate-300">
                  {selected.length} selected
                </span>
                <Button
                  onClick={onBulkDelete}
                  size="sm"
                  variant="destructive"
                  className="h-7 px-3 text-xs bg-red-500/90 hover:bg-red-500 text-white rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={bulkDeleteLoading}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  <span>{bulkDeleteLoading ? 'Deleting...' : 'Delete'}</span>
                  {bulkDeleteLoading && (
                    <svg className="animate-spin ml-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                  )}
                </Button>
              </div>
            )}
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48 rounded-lg bg-slate-900 text-slate-200 border-slate-700">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 text-slate-200 border-slate-700">
              <SelectItem value="all">All Jobs</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="verified">Queued (Verified)</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[60vh] overflow-y-auto flex-1 min-h-0">

        {isLoading && filteredJobs.length === 0 ? (
          <p className="text-slate-400">Loading...</p>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p>No jobs in this category.</p>
          </div>
        ) : (
          <AnimatePresence>
            {filteredJobs.map((job) => {
              const mediaFile = getMediaFile(job.media_file_id);
              const config = statusConfig[job.status as keyof typeof statusConfig] || {
                color: 'bg-slate-700 text-slate-200',
                icon: Clock,
              };
              const StatusIcon = config.icon;
              return (
                <motion.div
                  key={job.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="p-5 border-0 rounded-xl shadow-md bg-slate-900/80 hover:scale-[1.01] transition-transform duration-200 cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selected.includes(job.id!)}
                      onChange={() => handleRowSelect(job.id!)}
                      className="w-4 h-4 mt-2 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2 transition-all duration-200"
                      title="Select job"
                    />
                    <div className="flex-1 space-y-2">
                      <h3 className="font-semibold text-white text-base">
                        {mediaFile?.file_name || 'Loading...'}
                      </h3>
                      <div className="flex items-center gap-2">
                        <Badge className={`${config.color} capitalize rounded-full px-3 py-1 text-xs font-semibold border border-slate-700`}> <StatusIcon className="w-3 h-3 mr-1.5" /> {job.status}
                        </Badge>
                        <Badge variant="outline" className="rounded-full px-3 py-1 text-xs border-slate-700 text-slate-200">
                          Profile: {profiles.find((p) => p.id === job.profile_id)?.name || 'Auto'}
                        </Badge>
                      </div>
                      {job.status === 'processing' && (
                        <Progress value={Math.random() * 80 + 10} className="h-2 mt-2 rounded-full bg-slate-700" />
                      )}
                    </div>
                    {job.status === 'processing' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onStopProcessing(job.id!)}
                        className="rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200"
                      >
                        <Pause className="w-5 h-5" />
                      </Button>
                    )}
                    {job.status === 'completed' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDeleteJob(job.id!)}
                        className="rounded-full bg-slate-800 hover:bg-red-700 text-red-400"
                        title="Remove job"
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </CardContent>
    </Card>
  );
}
