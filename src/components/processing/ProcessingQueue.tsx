import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Play,
  Pause,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileVideo,
  List,
  Trash2,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProcessingJob, MediaFile, ProcessingProfile } from '../entities/all';
import { ProcessingJobEntity } from '../entities/ProcessingJob';
import { apiClient } from '../../integration/api-client';
import { FixedSizeList as VirtualList } from 'react-window';
import { filterJobsByCategory } from '@/utils/jobFilters.tsx';

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
  jobProgress?: Record<
    string,
    { progress: number; fps: number; currentFile: any; updated: number }
  >;
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
  jobProgress = {},
}: ProcessingQueueProps) {
  const [filter, setFilter] = useState<string>('all');
  const [selectAllLoading, setSelectAllLoading] = useState(false);
  const [allJobIds, setAllJobIds] = useState<(string | number)[]>([]);
  const jobsWithId = jobs.filter((job) => job.id !== undefined && job.id !== null);
  // Update dropdown filter options and logic
  const filterOptions = [
    { value: 'all', label: 'All Jobs' },
    { value: 'queued', label: 'Queued' },
    { value: 'processing', label: 'Processing' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' },
  ];

  // Show all jobs by default, filter by dropdown selection
  const filteredJobs = filterJobsByCategory(jobsWithId, filter as any);
  console.log('ProcessingQueue render:', { isLoading, jobs, filteredJobs });
  const [cpuLimit, setCpuLimit] = useState<number>(2);
  const [gpuLimit, setGpuLimit] = useState<number>(1);
  const [cpuPaused, setCpuPaused] = useState(false);
  const [gpuPaused, setGpuPaused] = useState(false);
  const [prevCpuLimit, setPrevCpuLimit] = useState<number>(2);
  const [prevGpuLimit, setPrevGpuLimit] = useState<number>(1);
  const [workerSaving, setWorkerSaving] = useState<'idle' | 'saving' | 'saved'>('idle');

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

  // Fetch worker limits on mount
  useEffect(() => {
    const fetchWorkerLimits = async () => {
      try {
        const settings = await apiClient.getAllSettings();
        const cpu = parseInt(settings.cpu_worker_limit, 10) || 2;
        const gpu = parseInt(settings.gpu_worker_limit, 10) || 1;
        setCpuLimit(cpu);
        setPrevCpuLimit(cpu);
        setGpuLimit(gpu);
        setPrevGpuLimit(gpu);
        setCpuPaused(cpu === 0);
        setGpuPaused(gpu === 0);
      } catch (err) {
        // ignore
      }
    };
    fetchWorkerLimits();
  }, []);

  // Save worker limits
  const saveWorkerLimits = async (cpu: number, gpu: number) => {
    setWorkerSaving('saving');
    try {
      await apiClient.setAllSettings({ cpu_worker_limit: cpu, gpu_worker_limit: gpu });
      setWorkerSaving('saved');
      setTimeout(() => setWorkerSaving('idle'), 1200);
    } catch (err) {
      setWorkerSaving('idle');
    }
  };

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
  const handleSelectAll = () => {
    if (allSelected) {
      setSelected([]);
    } else {
      setSelected(filteredJobs.map((job) => job.id!));
    }
  };

  const handleRowSelect = (jobId: string | number) => {
    if (jobId === undefined || jobId === null) {
      return;
    }
    if (selected.includes(jobId)) {
      setSelected(selected.filter((id) => id !== jobId));
    } else {
      setSelected([...selected, jobId]);
    }
  };

  // Handlers for custom controls
  const handleCpuChange = (val: number) => {
    setCpuLimit(val);
    setPrevCpuLimit(val);
    saveWorkerLimits(val, gpuLimit);
  };
  const handleGpuChange = (val: number) => {
    setGpuLimit(val);
    setPrevGpuLimit(val);
    saveWorkerLimits(cpuLimit, val);
  };
  const toggleCpuPause = async () => {
    if (cpuPaused) {
      await apiClient.resumeCpuWorkers();
      setCpuPaused(false);
    } else {
      await apiClient.pauseCpuWorkers();
      setCpuPaused(true);
    }
  };
  const toggleGpuPause = async () => {
    if (gpuPaused) {
      await apiClient.resumeGpuWorkers();
      setGpuPaused(false);
    } else {
      await apiClient.pauseGpuWorkers();
      setGpuPaused(true);
    }
  };

  return (
    <Card className="border-0 rounded-2xl shadow-lg bg-slate-800/90 backdrop-blur-md flex flex-col min-h-0">
      <CardHeader>
        <div className="relative flex items-center justify-between">
          {/* Left group: title, select all, delete */}
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
                <span className="text-xs text-slate-300">{selected.length} selected</span>
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
                    <svg
                      className="animate-spin ml-2 h-3 w-3 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8z"
                      ></path>
                    </svg>
                  )}
                </Button>
              </div>
            )}
          </div>
          {/* Centered worker controls */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-4 z-10">
            {/* CPU Controls */}
            <div className="flex items-center gap-1">
              <button
                className={`rounded-full p-1 bg-slate-700 hover:bg-blue-700 transition text-xs ${cpuPaused ? 'opacity-50' : ''}`}
                style={{ minWidth: 22, height: 22 }}
                onClick={() => !cpuPaused && handleCpuChange(Math.max(1, cpuLimit - 1))}
                disabled={cpuPaused || cpuLimit <= 1}
                tabIndex={-1}
                aria-label="Decrease CPU workers"
              >
                –
              </button>
              <span className="text-xs text-slate-300 font-semibold ml-1">CPU</span>
              <span className="w-5 text-center text-xs font-bold text-white select-none mx-1">
                {cpuLimit}
              </span>
              <button
                className={`rounded-full p-1 bg-slate-700 hover:bg-blue-700 transition text-xs ${cpuPaused ? 'opacity-50' : ''}`}
                style={{ minWidth: 22, height: 22 }}
                onClick={() => !cpuPaused && handleCpuChange(Math.min(16, cpuLimit + 1))}
                disabled={cpuPaused || cpuLimit >= 16}
                tabIndex={-1}
                aria-label="Increase CPU workers"
              >
                +
              </button>
              <button
                className={`ml-1 rounded-full p-1 ${cpuPaused ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-600 hover:bg-yellow-700'} transition`}
                style={{ minWidth: 22, height: 22 }}
                onClick={toggleCpuPause}
                aria-label={cpuPaused ? 'Resume CPU workers' : 'Pause CPU workers'}
                title={cpuPaused ? 'Resume CPU workers' : 'Pause CPU workers'}
              >
                {cpuPaused ? (
                  <Play className="w-3 h-3 text-white" />
                ) : (
                  <Pause className="w-3 h-3 text-white" />
                )}
              </button>
            </div>
            {/* GPU Controls */}
            <div className="flex items-center gap-1">
              <button
                className={`rounded-full p-1 bg-slate-700 hover:bg-blue-700 transition text-xs ${gpuPaused ? 'opacity-50' : ''}`}
                style={{ minWidth: 22, height: 22 }}
                onClick={() => !gpuPaused && handleGpuChange(Math.max(1, gpuLimit - 1))}
                disabled={gpuPaused || gpuLimit <= 1}
                tabIndex={-1}
                aria-label="Decrease GPU workers"
              >
                –
              </button>
              <span className="text-xs text-slate-300 font-semibold ml-1">GPU</span>
              <span className="w-5 text-center text-xs font-bold text-white select-none mx-1">
                {gpuLimit}
              </span>
              <button
                className={`rounded-full p-1 bg-slate-700 hover:bg-blue-700 transition text-xs ${gpuPaused ? 'opacity-50' : ''}`}
                style={{ minWidth: 22, height: 22 }}
                onClick={() => !gpuPaused && handleGpuChange(Math.min(8, gpuLimit + 1))}
                disabled={gpuPaused || gpuLimit >= 8}
                tabIndex={-1}
                aria-label="Increase GPU workers"
              >
                +
              </button>
              <button
                className={`ml-1 rounded-full p-1 ${gpuPaused ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-600 hover:bg-yellow-700'} transition`}
                style={{ minWidth: 22, height: 22 }}
                onClick={toggleGpuPause}
                aria-label={gpuPaused ? 'Resume GPU workers' : 'Pause GPU workers'}
                title={gpuPaused ? 'Resume GPU workers' : 'Pause GPU workers'}
              >
                {gpuPaused ? (
                  <Play className="w-3 h-3 text-white" />
                ) : (
                  <Pause className="w-3 h-3 text-white" />
                )}
              </button>
            </div>
            {/* Save/Loading indicator with fixed width */}
            <div className="w-6 flex items-center justify-center">
              {workerSaving === 'saving' && (
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              )}
              {workerSaving === 'saved' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
            </div>
          </div>
          {/* Right group: filter dropdown */}
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48 rounded-lg bg-slate-900 text-slate-200 border-slate-700">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 text-slate-200 border-slate-700">
              {filterOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
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
          <VirtualList
            height={480} // 60vh
            itemCount={filteredJobs.length}
            itemSize={90}
            width={'100%'}
          >
            {({ index, style }) => {
              const job = filteredJobs[index];
              const mediaFile = getMediaFile(job.media_file_id);
              const config = statusConfig[job.status as keyof typeof statusConfig] || {
                color: 'bg-slate-700 text-slate-200',
                icon: Clock,
              };
              const StatusIcon = config.icon;
              return (
                <div style={style} key={job.id}>
                  <motion.div
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
                        disabled={job.id === undefined || job.id === null}
                      />
                      <div className="flex-1 space-y-2">
                        <h3 className="font-semibold text-white text-base">
                          {mediaFile?.file_name || 'Loading...'}
                        </h3>
                        <div className="flex items-center gap-2">
                          <Badge
                            className={`${config.color} capitalize rounded-full px-3 py-1 text-xs font-semibold border border-slate-700`}
                          >
                            {' '}
                            <StatusIcon className="w-3 h-3 mr-1.5" /> {job.status}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="rounded-full px-3 py-1 text-xs border-slate-700 text-slate-200"
                          >
                            Profile: {profiles.find((p) => p.id === job.profile_id)?.name || 'Auto'}
                          </Badge>
                        </div>
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
                </div>
              );
            }}
          </VirtualList>
        )}
      </CardContent>
    </Card>
  );
}
