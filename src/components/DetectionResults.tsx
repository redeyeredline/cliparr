import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Play,
  Clock,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Info,
  Eye,
  EyeOff,
} from 'lucide-react';
import { apiClient } from '../integration/api-client';

interface Segment {
  id: number;
  start: number;
  end: number;
  medianTime: number;
  episodeCount: number;
  fingerprintCount: number;
  episodeIds: number[];
  times: number[];
}

interface DetectionResult {
  season_number: number;
  episode_number: number;
  intro_start: number | null;
  intro_end: number | null;
  credits_start: number | null;
  credits_end: number | null;
  stingers: Segment[];
  segments: Segment[];
  confidence_score: number;
  detection_method: string;
  approval_status: string;
  processing_notes: string;
}

interface DetectionResultsProps {
  showId: number;
  seasonNumber?: number;
}

export default function DetectionResults({ showId, seasonNumber }: DetectionResultsProps) {
  const [results, setResults] = useState<DetectionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSegments, setSelectedSegments] = useState<Set<string>>(new Set());

  const fetchDetectionResults = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.getDetectionSegments(showId, seasonNumber);

      if (response.success) {
        setResults(response.segments);
      } else {
        throw new Error(response.error || 'Failed to fetch detection results');
      }
    } catch (err: any) {
      console.error('Failed to fetch detection results:', err);
      setError(err.message || 'Failed to fetch detection results');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetectionResults();
  }, [showId, seasonNumber]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (start: number, end: number) => {
    const duration = end - start;
    return formatTime(duration);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) {
      return 'bg-green-100 text-green-800';
    }
    if (confidence >= 0.6) {
      return 'bg-yellow-100 text-yellow-800';
    }
    return 'bg-red-100 text-red-800';
  };

  const getApprovalStatusColor = (status: string) => {
    switch (status) {
      case 'auto_approved':
        return 'bg-green-100 text-green-800';
      case 'manual_approved':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const toggleSegment = (segmentType: string, segmentId: number) => {
    const key = `${segmentType}-${segmentId}`;
    const newSelected = new Set(selectedSegments);

    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }

    setSelectedSegments(newSelected);
  };

  const renderSegmentCard = (segment: Segment, type: string, index: number) => {
    const key = `${type}-${segment.id}`;
    const isSelected = selectedSegments.has(key);

    return (
      <Card
        key={segment.id}
        className={`mb-4 transition-all duration-200 ${
          isSelected ? 'ring-2 ring-blue-500 bg-blue-50/10' : 'bg-gray-800/30'
        }`}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-xs">
                {type.charAt(0).toUpperCase() + type.slice(1)} {index + 1}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => toggleSegment(type, segment.id)}
                className="h-6 w-6 p-0"
              >
                {isSelected ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </Button>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-400">{formatTime(segment.medianTime)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Time Range:</span>
              <span className="text-white">
                {formatTime(segment.start)} - {formatTime(segment.end)}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Duration:</span>
              <span className="text-white">{formatDuration(segment.start, segment.end)}</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Episodes:</span>
              <span className="text-white">
                {segment.episodeCount} / {results.length}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Fingerprints:</span>
              <span className="text-white">{segment.fingerprintCount}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderEpisodeResults = (result: DetectionResult) => {
    const hasIntro = result.intro_start !== null && result.intro_end !== null;
    const hasCredits = result.credits_start !== null && result.credits_end !== null;
    const hasStingers = result.stingers && result.stingers.length > 0;
    const hasSegments = result.segments && result.segments.length > 0;

    return (
      <Card key={`${result.season_number}-${result.episode_number}`} className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              S{result.season_number}E{result.episode_number.toString().padStart(2, '0')}
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Badge className={getConfidenceColor(result.confidence_score)}>
                {(result.confidence_score * 100).toFixed(0)}% confidence
              </Badge>
              <Badge className={getApprovalStatusColor(result.approval_status)}>
                {result.approval_status.replace('_', ' ')}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Intro */}
          {hasIntro && (
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center">
                <Play className="w-4 h-4 mr-2" />
                Intro
              </h4>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Time Range:</span>
                  <span className="text-white">
                    {formatTime(result.intro_start!)} - {formatTime(result.intro_end!)}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-400">Duration:</span>
                  <span className="text-white">
                    {formatDuration(result.intro_start!, result.intro_end!)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Credits */}
          {hasCredits && (
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center">
                <Play className="w-4 h-4 mr-2" />
                Credits
              </h4>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Time Range:</span>
                  <span className="text-white">
                    {formatTime(result.credits_start!)} - {formatTime(result.credits_end!)}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-400">Duration:</span>
                  <span className="text-white">
                    {formatDuration(result.credits_start!, result.credits_end!)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Stingers */}
          {hasStingers && (
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Stingers ({result.stingers.length})
              </h4>
              <div className="space-y-2">
                {result.stingers.map((stinger, index) =>
                  renderSegmentCard(stinger, 'stinger', index),
                )}
              </div>
            </div>
          )}

          {/* All Segments */}
          {hasSegments && (
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center">
                <BarChart3 className="w-4 h-4 mr-2" />
                All Detected Segments ({result.segments.length})
              </h4>
              <div className="space-y-2">
                {result.segments.map((segment, index) =>
                  renderSegmentCard(segment, 'segment', index),
                )}
              </div>
            </div>
          )}

          {/* Processing Notes */}
          {result.processing_notes && (
            <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
              <div className="flex items-start space-x-2">
                <Info className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h5 className="text-sm font-medium text-gray-300 mb-1">Processing Notes</h5>
                  <p className="text-sm text-gray-400">{result.processing_notes}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3"></div>
            <span className="text-gray-400">Loading detection results...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <span>Error: {error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (results.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="w-12 h-12 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-3">
            <BarChart3 className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-300 mb-2">No Detection Results</h3>
          <p className="text-gray-400">
            {seasonNumber
              ? `No detection results found for Season ${seasonNumber}`
              : 'No detection results found for this show'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Detection Results</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={fetchDetectionResults}
          className="text-gray-400 hover:text-white"
        >
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="episodes" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="episodes">By Episode</TabsTrigger>
          <TabsTrigger value="segments">By Segment Type</TabsTrigger>
        </TabsList>

        <TabsContent value="episodes" className="space-y-4">
          {results.map(renderEpisodeResults)}
        </TabsContent>

        <TabsContent value="segments" className="space-y-6">
          {/* Intro Segments */}
          {results.some((r) => r.intro_start !== null) && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Intro Segments</h3>
              {results
                .filter((r) => r.intro_start !== null)
                .map((result, index) => (
                  <Card key={`intro-${index}`} className="mb-3">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center">
                        <span className="text-white">
                          S{result.season_number}E
                          {result.episode_number.toString().padStart(2, '0')}
                        </span>
                        <span className="text-gray-400">
                          {formatTime(result.intro_start!)} - {formatTime(result.intro_end!)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}

          {/* Credits Segments */}
          {results.some((r) => r.credits_start !== null) && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Credits Segments</h3>
              {results
                .filter((r) => r.credits_start !== null)
                .map((result, index) => (
                  <Card key={`credits-${index}`} className="mb-3">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center">
                        <span className="text-white">
                          S{result.season_number}E
                          {result.episode_number.toString().padStart(2, '0')}
                        </span>
                        <span className="text-gray-400">
                          {formatTime(result.credits_start!)} - {formatTime(result.credits_end!)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}

          {/* Stinger Segments */}
          {results.some((r) => r.stingers && r.stingers.length > 0) && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Stinger Segments</h3>
              {results
                .filter((r) => r.stingers && r.stingers.length > 0)
                .flatMap((r) =>
                  r.stingers.map((stinger, index) => ({
                    ...stinger,
                    episode: r,
                    stingerIndex: index,
                  })),
                )
                .map((stinger, index) => renderSegmentCard(stinger, 'stinger', index))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
