import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Gauge, Zap, CheckCircle2 } from 'lucide-react';

interface BenchmarkResults {
  cpu_score: number;
  gpu_score: number;
  memory_bandwidth: number;
  encoding_speed: {
    [key: string]: { [key: string]: number };
  };
  recommended_profiles: string[];
  benchmark_duration: number;
  timestamp: string;
  note?: string;
}

interface HardwareInfo {
  gpu_name?: string;
  cpu_cores?: number;
  memory_gb?: number;
  ffmpeg_version?: string;
  nvenc_support?: boolean;
  qsv_support?: boolean;
  last_detected?: string;
}

interface PerformanceBenchmarkProps {
  benchmarkResults: BenchmarkResults | null;
  isBenchmarking: boolean;
  hardwareInfo: HardwareInfo | null;
  onRunBenchmark: () => void;
  progress?: {
    stage: string;
    percent: number;
    status: string;
    message: string;
    partialResults?: any;
  } | null;
}

const encodeTypesBase = [
  { key: 'h264_cpu', label: 'H.264 CPU', fill: '#8884d8' },
  { key: 'h264_gpu', label: 'H.264 GPU', fill: '#82ca9d' },
  { key: 'h265_cpu', label: 'H.265 CPU', fill: '#ffc658' },
  { key: 'h265_gpu', label: 'H.265 GPU', fill: '#ff8042' },
];
const resolutions = [
  { key: '1080p', label: '1080p' },
  { key: '4k', label: '4K' },
];

function getAvailableEncodeTypes(hardwareInfo: HardwareInfo | null) {
  // Only show GPU bars if hardware supports NVENC or QSV
  if (!hardwareInfo) {
    return encodeTypesBase;
  }
  return encodeTypesBase.filter((type) => {
    if (type.key.endsWith('_gpu')) {
      return hardwareInfo.nvenc_support || hardwareInfo.qsv_support;
    }
    return true;
  });
}

function getLiveEncodingSpeed(
  isBenchmarking: boolean,
  progress: PerformanceBenchmarkProps['progress'],
  benchmarkResults: BenchmarkResults | null,
) {
  // Use partialResults if benchmarking, else use final results
  if (isBenchmarking && progress?.partialResults?.encoding_speed) {
    return progress.partialResults.encoding_speed;
  }
  if (benchmarkResults) {
    return benchmarkResults.encoding_speed;
  }
  // Default: all zero
  return {
    h264_cpu: { '1080p': 0, '4k': 0 },
    h264_gpu: { '1080p': 0, '4k': 0 },
    h265_cpu: { '1080p': 0, '4k': 0 },
    h265_gpu: { '1080p': 0, '4k': 0 },
  };
}

export default function PerformanceBenchmark({
  benchmarkResults,
  isBenchmarking,
  hardwareInfo,
  onRunBenchmark,
  progress,
}: PerformanceBenchmarkProps) {
  const encodeTypes = getAvailableEncodeTypes(hardwareInfo);
  const encoding_speed = getLiveEncodingSpeed(isBenchmarking, progress, benchmarkResults);

  // Find max FPS for scaling bars
  let allFps: number[] = [];
  for (const type of encodeTypes) {
    for (const res of resolutions) {
      const val = encoding_speed[type.key]?.[res.key];
      if (typeof val === 'number') {
        allFps.push(val);
      }
    }
  }
  const maxFps = Math.max(...allFps, 1);

  // Determine which test is running (if any)
  let runningTest: { typeKey: string; resKey: string } | null = null;
  if (isBenchmarking && progress?.stage && progress?.stage.startsWith('encoding:')) {
    // e.g. encoding:h264_cpu:1080p
    const parts = progress.stage.split(':');
    if (parts.length === 3) {
      runningTest = { typeKey: parts[1], resKey: parts[2] };
    }
  }

  return (
    <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl border border-gray-700/30 shadow-2xl p-8 w-full min-h-[540px] min-w-[340px] flex flex-col justify-between">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Gauge className="w-5 h-5 text-white" />
          <span className="text-xl font-bold text-white">Performance Benchmark</span>
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-between w-full">
        <div className="min-h-[340px] flex flex-col justify-center w-full">
          {/* Always show the bar graph, even before running */}
          <div className="h-64 flex flex-col justify-center w-full">
            <div className="space-y-2 w-full">
              {encodeTypes.map((type) => (
                <div key={type.key} className="mb-3 w-full">
                  <div className="font-semibold text-gray-200 mb-1">{type.label}</div>
                  {resolutions.map((res) => {
                    const fps = encoding_speed[type.key]?.[res.key] || 0;
                    const isRunning =
                      isBenchmarking &&
                      runningTest &&
                      runningTest.typeKey === type.key &&
                      runningTest.resKey === res.key;
                    const isDone = fps > 0;
                    return (
                      <div key={res.key} className="flex items-center space-x-2 mb-1 w-full">
                        <span className="text-xs text-gray-400 w-10 font-medium">{res.label}</span>
                        <div className="flex-1 bg-gray-700/40 rounded-full h-5 relative overflow-hidden w-full">
                          {/* Bar fill or spinner */}
                          {isRunning ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-400"></div>
                            </div>
                          ) : isDone ? (
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.round((fps / maxFps) * 100)}%`,
                                backgroundColor: type.fill,
                              }}
                            />
                          ) : (
                            <div className="h-full rounded-full bg-gray-600 opacity-40" style={{ width: '100%' }} />
                          )}
                        </div>
                        <span className="text-xs font-semibold w-12 text-right text-gray-200">
                          {isRunning ? (
                            <span className="text-gray-400">...</span>
                          ) : isDone ? (
                            `${fps} fps`
                          ) : (
                            ''
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Recommended profiles and note, only after results */}
        {benchmarkResults && (
          <>
            <div className="mt-6">
              <h4 className="font-semibold text-white mb-2">Recommended Profiles:</h4>
              <div className="flex flex-wrap gap-2">
                {benchmarkResults.recommended_profiles.map((profile: string) => (
                  <Badge key={profile} variant="outline" className="bg-emerald-900/30 text-emerald-200 border-emerald-700/40">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    {profile}
                  </Badge>
                ))}
              </div>
            </div>
            {benchmarkResults.note && (
              <div className="text-xs text-gray-400 mt-2">{benchmarkResults.note}</div>
            )}
          </>
        )}
        {/* Benchmark button and status */}
        <div className="w-full flex flex-col items-center mt-6">
          {isBenchmarking ? (
            <div className="text-center text-gray-300 text-sm">
              {progress?.message || 'Running benchmark, please wait...'}
              <div className="text-xs text-gray-400 mt-1">(This may take a few minutes)</div>
            </div>
          ) : (
            <Button onClick={onRunBenchmark} disabled={!hardwareInfo} className="w-full bg-gray-700/60 text-white hover:bg-gray-700/80">
              <Zap className="w-4 h-4 mr-2" />
              {benchmarkResults ? 'Run Benchmark Again' : 'Start Benchmark'}
            </Button>
          )}
          {!hardwareInfo && !isBenchmarking && (
            <p className="text-xs text-gray-400 mt-2">Please detect hardware first</p>
          )}
        </div>
      </div>
    </div>
  );
}
