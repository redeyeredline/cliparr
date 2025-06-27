import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Gauge, Zap, CheckCircle2 } from 'lucide-react';

interface BenchmarkResults {
  encoding_speed: {
    h264_cpu: number;
    h264_gpu: number;
    h265_cpu: number;
    h265_gpu: number;
  };
  recommended_profiles: string[];
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
}

export default function PerformanceBenchmark({
  benchmarkResults,
  isBenchmarking,
  hardwareInfo,
  onRunBenchmark,
}: PerformanceBenchmarkProps) {
  const benchmarkData = benchmarkResults ? [
    { name: 'H.264 CPU', speed: benchmarkResults.encoding_speed.h264_cpu, fill: '#8884d8' },
    { name: 'H.264 GPU', speed: benchmarkResults.encoding_speed.h264_gpu, fill: '#82ca9d' },
    { name: 'H.265 CPU', speed: benchmarkResults.encoding_speed.h265_cpu, fill: '#ffc658' },
    { name: 'H.265 GPU', speed: benchmarkResults.encoding_speed.h265_gpu, fill: '#ff8042' },
  ] : [];

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="w-5 h-5" />
          Performance Benchmark
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isBenchmarking ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-slate-900 mx-auto"></div>
            <p className="mt-4 text-slate-600">Running benchmark, please wait...</p>
            <p className="text-sm text-slate-500">(This may take a few minutes)</p>
          </div>
        ) : benchmarkResults ? (
          <div className="space-y-4">
            <div className="h-48">
              {/* Simple bar chart representation without recharts */}
              <div className="space-y-2">
                {benchmarkData.map((item) => (
                  <div key={item.name} className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600 w-20">{item.name}</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-4">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min((item.speed / 100) * 100, 100)}%`,
                          backgroundColor: item.fill,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium">{item.speed}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-2">Recommended Profiles:</h4>
              <div className="flex flex-wrap gap-2">
                {benchmarkResults.recommended_profiles.map((profile: string) => (
                  <Badge key={profile} variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    {profile}
                  </Badge>
                ))}
              </div>
            </div>
            <Button onClick={onRunBenchmark} className="w-full mt-4">
              Run Benchmark Again
            </Button>
          </div>
        ) : (
          <div className="text-center py-8">
            <Gauge className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <h3 className="font-semibold text-slate-600 mb-2">Run Benchmark</h3>
            <p className="text-slate-500 mb-4">Test your system's performance for optimal settings</p>
            <Button onClick={onRunBenchmark} disabled={!hardwareInfo}>
              <Zap className="w-4 h-4 mr-2" />
              Start Benchmark
            </Button>
            {!hardwareInfo && <p className="text-xs text-slate-500 mt-2">Please detect hardware first</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
