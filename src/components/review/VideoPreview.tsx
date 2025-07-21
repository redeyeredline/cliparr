import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '../ui/slider';
import { Check, X, SkipForward, Play, Scissors, Clapperboard, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { ProcessingJob, MediaFile } from '@/components/entities/all';

interface VideoPreviewProps {
  job: ProcessingJob | null;
  mediaFile: MediaFile | null;
  onVerify: (jobId: string | number, verified?: boolean) => void;
  onUpdateTimestamps: (jobId: string | number, timestamps: Partial<ProcessingJob>) => void;
  onSkip: () => void;
}

interface TimelineEditorProps {
  title: string;
  icon: React.ElementType;
  range: [number, number];
  onRangeChange: (range: [number, number]) => void;
  totalDuration: number;
  color: string;
}

const formatTime = (seconds: number, totalDuration: number) => {
  if (seconds === null || seconds === undefined || !totalDuration) {
    return '0:00';
  }
  const absSeconds = Math.max(0, Math.min(seconds, totalDuration));
  const mins = Math.floor(absSeconds / 60);
  const secs = Math.floor(absSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const TimelineEditor = ({
  title,
  icon: Icon,
  range,
  onRangeChange,
  totalDuration,
  color,
}: TimelineEditorProps) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-slate-400" />
        <h4 className="font-semibold text-slate-200">{title}</h4>
      </div>
      <div className="font-mono text-sm px-3 py-1.5 bg-slate-800 rounded-md text-slate-200">
        {formatTime(range[0], totalDuration)} - {formatTime(range[1], totalDuration)}
      </div>
    </div>
    <Slider
      value={range}
      onValueChange={onRangeChange}
      max={totalDuration}
      step={1}
      minStepsBetweenThumbs={5}
      className="py-2"
      thumbClassName={color}
    />
  </motion.div>
);

export default function VideoPreview({
  job,
  mediaFile,
  onVerify,
  onUpdateTimestamps,
  onSkip,
}: VideoPreviewProps) {
  const [intro, setIntro] = useState<[number, number]>([0, 0]);
  const [credits, setCredits] = useState<[number, number]>([0, 0]);
  const [hasChanges, setHasChanges] = useState(false);

  const totalDuration = mediaFile?.duration || 1;

  useEffect(() => {
    if (job) {
      setIntro([job.intro_start || 0, job.intro_end || 0]);
      setCredits([job.credits_start || 0, job.credits_end || 0]);
      setHasChanges(false);
    }
  }, [job]);

  const handleIntroChange = (newRange: [number, number]) => {
    setIntro(newRange);
    setHasChanges(true);
  };

  const handleCreditsChange = (newRange: [number, number]) => {
    setCredits(newRange);
    setHasChanges(true);
  };

  const handleSaveChanges = () => {
    if (!job) {
      return;
    }
    onUpdateTimestamps(job.id!, {
      intro_start: intro[0],
      intro_end: intro[1],
      credits_start: credits[0],
      credits_end: credits[1],
    });
    setHasChanges(false);
  };

  if (!job || !mediaFile) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Clapperboard className="w-24 h-24 mx-auto text-gray-700" />
          <h3 className="mt-4 text-xl font-semibold text-gray-400">Select a job to review</h3>
          <p className="text-gray-500">Choose a video from the queue to begin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col border border-gray-700/30 shadow-2xl bg-gray-800/30 rounded-2xl backdrop-blur-sm">
      <div className="p-6 border-b border-gray-700/30">
        <div className="truncate text-2xl font-bold text-white">{mediaFile.file_name}</div>
        <p className="text-gray-400">
          {mediaFile.series_name} S{mediaFile.season?.toString().padStart(2, '0')}E
          {mediaFile.episode?.toString().padStart(2, '0')}
        </p>
      </div>
      <div className="flex-1 flex flex-col gap-8 p-6">
        {/* Video Player Placeholder */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative w-full aspect-video bg-gray-900 rounded-2xl flex items-center justify-center shadow-2xl shadow-black/20"
        >
          <Play className="w-20 h-20 text-white/20" />
          <div className="absolute bottom-4 right-4 bg-black/50 text-white px-3 py-1 text-sm rounded-lg">
            {formatTime(totalDuration, totalDuration)}
          </div>
          <Badge className="absolute top-4 right-4 bg-emerald-700/90 text-white border-0">
            Confidence: {(job.confidence_score * 100).toFixed(0)}%
          </Badge>
        </motion.div>
        {/* Timeline Editors */}
        <div className="space-y-8">
          <TimelineEditor
            title="Intro Sequence"
            icon={Play}
            range={intro}
            onRangeChange={handleIntroChange}
            totalDuration={totalDuration}
            color="bg-blue-500"
          />
          <TimelineEditor
            title="Credit Sequence"
            icon={Scissors}
            range={credits}
            onRangeChange={handleCreditsChange}
            totalDuration={totalDuration}
            color="bg-purple-500"
          />
        </div>
      </div>
      <div className="flex justify-end items-center gap-4 p-6 pt-0 border-t border-gray-700/30">
        <Button variant="ghost" onClick={onSkip} className="text-gray-300">
          <SkipForward className="w-4 h-4 mr-2" />
          Skip
        </Button>
        {hasChanges && (
          <Button
            variant="outline"
            onClick={handleSaveChanges}
            className="border-blue-700 text-blue-300"
          >
            Save Changes
          </Button>
        )}
        <Button
          onClick={() => onVerify(job.id!, true)}
          className="bg-emerald-700 hover:bg-emerald-800 text-white"
        >
          <Check className="w-4 h-4 mr-2" />
          Approve
        </Button>
      </div>
    </div>
  );
}
