import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Package, Play, CheckCircle2, Clock, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { ProcessingJob, MediaFile, ProcessingProfile } from '../entities/all';
import { useToast } from '../ToastContext';

interface BatchProcessorProps {
  jobs: ProcessingJob[];
  mediaFiles: MediaFile[];
  profiles: ProcessingProfile[];
  onStartBatch: (jobIds: (string | number)[], profileId: string | number) => Promise<void>;
}

export default function BatchProcessor({
  jobs,
  mediaFiles,
  profiles,
  onStartBatch,
}: BatchProcessorProps) {
  const [selectedJobs, setSelectedJobs] = useState<Set<string | number>>(new Set());
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const toast = useToast();

  const getMediaFile = (mediaFileId: string | number): MediaFile | undefined => {
    return mediaFiles.find((f) => f.id === mediaFileId);
  };

  const handleJobSelect = (jobId: string | number, checked: boolean) => {
    const newSelected = new Set(selectedJobs);
    if (checked) {
      newSelected.add(jobId);
    } else {
      newSelected.delete(jobId);
    }
    setSelectedJobs(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedJobs(new Set(jobs.map((j) => j.id!)));
    } else {
      setSelectedJobs(new Set());
    }
  };

  const handleStartBatch = async () => {
    if (selectedJobs.size === 0 || !selectedProfile) {
      return;
    }

    setIsProcessing(true);
    try {
      await onStartBatch([...selectedJobs], selectedProfile);
      setSelectedJobs(new Set());
      setSelectedProfile('');
      toast({ type: 'success', message: `Started batch processing for ${selectedJobs.size} jobs` });
    } catch (error) {
      console.error('Batch processing failed:', error);
      toast({ type: 'error', message: 'Failed to start batch processing' });
    }
    setIsProcessing(false);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const estimatedTime = selectedJobs.size * 15; // 15 minutes average per file

  // Show toast when jobs are selected
  React.useEffect(() => {
    if (selectedJobs.size > 0) {
      const timeText = `${Math.floor(estimatedTime / 60)}h ${estimatedTime % 60}m`;
      toast({
        type: 'info',
        message: `Estimated processing time: ${timeText} (${selectedJobs.size} files × ~15min average)`,
        duration: 5000,
      });
    }
  }, [selectedJobs.size, estimatedTime, toast]);

  return (
    <div className="space-y-6">
      {/* Batch Controls */}
      <Card className="border-0 rounded-2xl shadow-lg bg-slate-800/90 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-bold text-white">
            <Package className="w-5 h-5" />
            Batch Processing Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Processing Profile</label>
              <Select value={selectedProfile} onValueChange={setSelectedProfile}>
                <SelectTrigger className="rounded-lg bg-slate-900 text-slate-200 border-slate-700">
                  <SelectValue placeholder="Select processing profile" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 text-slate-200 border-slate-700">
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id?.toString() || ''}>
                      {profile.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="auto">Auto Profile (Recommended)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Selected Jobs</label>
              <div className="p-2 bg-slate-900 rounded-lg border border-slate-700 text-sm text-slate-200">
                {selectedJobs.size} of {jobs.length} jobs selected
              </div>
            </div>
          </div>
          <div className="flex justify-between items-center pt-4 border-t border-slate-700">
            <div className="text-sm text-slate-300">
              Select jobs below and choose a processing profile to start batch processing
            </div>
            <Button
              onClick={handleStartBatch}
              disabled={selectedJobs.size === 0 || !selectedProfile || isProcessing}
              className="bg-blue-700 hover:bg-blue-800 rounded-lg px-6 py-2 text-base text-white"
            >
              <Play className="w-4 h-4 mr-2" />
              {isProcessing ? 'Starting...' : `Start Batch (${selectedJobs.size})`}
            </Button>
          </div>
        </CardContent>
      </Card>
      {/* Job Selection */}
      <Card className="border-0 rounded-2xl shadow-lg bg-slate-800/90 backdrop-blur-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-white">
              <CheckCircle2 className="w-5 h-5" />
              Verified Jobs ({jobs.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedJobs.size === jobs.length && jobs.length > 0}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2 transition-all duration-200"
              />
              <span className="text-sm text-slate-200">Select All</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Clock className="w-16 h-16 mx-auto mb-4 text-slate-700" />
              <h3 className="font-semibold text-slate-400 mb-2">No Verified Jobs</h3>
              <p className="text-slate-500">
                Jobs that have been manually verified will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => {
                const mediaFile = getMediaFile(job.media_file_id);
                const isSelected = selectedJobs.has(job.id!);
                return (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 border-0 rounded-xl shadow bg-slate-900/80 cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? 'border-blue-700 bg-slate-900 shadow-md scale-[1.01]'
                        : 'border-slate-700 hover:border-blue-700'
                    }`}
                    onClick={() => handleJobSelect(job.id!, !isSelected)}
                  >
                    <div className="flex items-center gap-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleJobSelect(job.id!, e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2 transition-all duration-200"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white truncate">
                          {mediaFile?.file_name || 'Unknown File'}
                        </h3>
                        {mediaFile?.series_name && (
                          <p className="text-sm text-slate-400 truncate">
                            {mediaFile.series_name} S{mediaFile.season?.toString().padStart(2, '0')}
                            E{mediaFile.episode?.toString().padStart(2, '0')}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                          {job.intro_start && job.intro_end && (
                            <span>
                              Intro: {formatTime(job.intro_start)} - {formatTime(job.intro_end)}
                            </span>
                          )}
                          {job.credits_start && job.credits_end && (
                            <span>
                              Credits: {formatTime(job.credits_start)} -{' '}
                              {formatTime(job.credits_end)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="inline-block bg-emerald-900 text-emerald-300 border border-emerald-700 rounded-full px-3 py-1 text-xs font-semibold">
                          <CheckCircle2 className="w-3 h-3 mr-1 inline" /> Verified
                        </span>
                        <span className="inline-block border border-slate-700 rounded-full px-3 py-1 text-xs text-slate-200">
                          {(job.confidence_score * 100).toFixed(0)}% confidence
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
