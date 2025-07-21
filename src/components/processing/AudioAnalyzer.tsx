import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { AudioAnalysis, MediaFile } from '../entities/all';
import { AudioWaveform, RefreshCw, Clock, Music, BarChart, Mic, Volume2 } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface AudioAnalyzerProps {
  audioAnalyses: AudioAnalysis[];
  mediaFiles: MediaFile[];
  onRefresh: () => Promise<void>;
}

export default function AudioAnalyzer({
  audioAnalyses,
  mediaFiles,
  onRefresh,
}: AudioAnalyzerProps) {
  const getMediaFile = (mediaFileId: string | number): MediaFile | undefined => {
    return mediaFiles.find((f) => f.id === mediaFileId);
  };

  return (
    <Card className="border-0 rounded-2xl shadow-lg bg-slate-800/90 backdrop-blur-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-white">
            <AudioWaveform className="w-5 h-5" />
            Audio Analysis
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            className="text-slate-200 hover:bg-slate-700"
          >
            <RefreshCw className="w-5 h-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {audioAnalyses.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p>No audio analysis data available.</p>
          </div>
        ) : (
          <AnimatePresence>
            {audioAnalyses.map((analysis) => {
              const mediaFile = getMediaFile(analysis.media_file_id);
              return (
                <motion.div
                  key={analysis.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 border-0 rounded-xl shadow bg-slate-900/80 text-slate-200"
                >
                  <h3 className="font-semibold mb-2 text-white">{mediaFile?.file_name || '...'}</h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Music className="w-4 h-4 text-blue-400" />
                      <span>Music Segments: {analysis.music_segments?.length || 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mic className="w-4 h-4 text-emerald-400" />
                      <span>Speech Segments: {analysis.speech_segments?.length || 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-amber-400" />
                      <span>
                        Avg Volume: {analysis.volume_analysis?.average_volume?.toFixed(2) || 'N/A'}{' '}
                        dB
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span>Analyzed: {format(new Date(analysis.created_date), 'MMM d')}</span>
                    </div>
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
