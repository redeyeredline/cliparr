import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle, Clock, XCircle, Play, Pause, Database, Activity, Server, FileText, Users, Settings } from 'lucide-react';
import { apiClient } from '../integration/api-client';
import { useToast } from '../components/ToastContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

interface JobStatus {
  database: {
    total: number;
    byStatus: Record<string, number>;
  };
  queues: Record<string, {
    waiting: number;
    active: number;
    delayed: number;
    completed: number;
    failed: number;
    total: number;
  }>;
  issues: Array<{
    type: string;
    count?: number;
    jobIds?: string[];
    error?: string;
    queue?: string;
    jobId?: string;
    age?: number;
    threshold?: number;
  }>;
  recoveryActive: boolean;
  timestamp: string;
}

interface ProcessingStatus {
  database: {
    total: number;
    byStatus: Record<string, number>;
  };
  queues: Record<string, {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }>;
  summary: {
    totalActive: number;
    totalWaiting: number;
    totalCompleted: number;
    totalFailed: number;
  };
  timestamp: string;
}

interface DetailedJob {
  id: number;
  status: string;
  media_file_id: number;
  file_path: string;
  episode_title: string;
  episode_number: number;
  season_number: number;
  show_title: string;
  confidence_score: number;
  intro_start?: number;
  intro_end?: number;
  credits_start?: number;
  credits_end?: number;
  manual_verified: boolean;
  processing_notes?: string;
  created_date: string;
  updated_date?: string;
}

const AdminPage: React.FC = () => {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null);
  const [detailedJobs, setDetailedJobs] = useState<DetailedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const toast = useToast();

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [jobRecoveryStatus, processingStatusData, detailedJobsData] = await Promise.all([
        apiClient.get('/processing/recovery/status'),
        apiClient.get('/processing/status'),
        apiClient.get('/processing/jobs?status=all')
      ]);

      setJobStatus(jobRecoveryStatus);
      setProcessingStatus(processingStatusData);
      setDetailedJobs(detailedJobsData.jobs || []);
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
      toast.error('Failed to fetch admin data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [fetchData]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'processing': return 'bg-blue-500';
      case 'scanning': return 'bg-yellow-500';
      case 'waiting': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'failed': return <XCircle className="w-4 h-4" />;
      case 'processing': return <Play className="w-4 h-4" />;
      case 'scanning': return <Clock className="w-4 h-4" />;
      case 'waiting': return <Clock className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'stale_job': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'missing_in_redis': return <Database className="w-4 h-4 text-red-500" />;
      case 'orphaned_in_redis': return <Server className="w-4 h-4 text-yellow-500" />;
      case 'sync_error': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <AlertTriangle className="w-4 h-4 text-red-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-gray-400 mt-2">System monitoring and debug information</p>
        </div>
        <Button
          onClick={fetchData}
          disabled={refreshing}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Last Updated */}
      {jobStatus && (
        <div className="text-sm text-gray-400">
          Last updated: {formatTimestamp(jobStatus.timestamp)}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="queues">Queue Status</TabsTrigger>
          <TabsTrigger value="jobs">Job Details</TabsTrigger>
          <TabsTrigger value="issues">Issues</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{jobStatus?.database.total || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Across all statuses
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
                <Play className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{processingStatus?.summary.totalActive || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Currently processing
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{processingStatus?.summary.totalCompleted || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Successfully processed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Failed</CardTitle>
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{processingStatus?.summary.totalFailed || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Failed jobs
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Database Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Database Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {jobStatus?.database.byStatus && Object.entries(jobStatus.database.byStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(status)}
                      <span className="capitalize">{status}</span>
                    </div>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recovery Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Recovery Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${jobStatus?.recoveryActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span>{jobStatus?.recoveryActive ? 'Active' : 'Inactive'}</span>
                <span className="text-gray-400">- Automatic job recovery</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Queue Status Tab */}
        <TabsContent value="queues" className="space-y-6">
          {jobStatus?.queues && Object.entries(jobStatus.queues).map(([queueName, queueStats]) => (
            <Card key={queueName}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  {queueName}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-500">{queueStats.waiting}</div>
                    <div className="text-sm text-gray-400">Waiting</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-500">{queueStats.active}</div>
                    <div className="text-sm text-gray-400">Active</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-500">{queueStats.delayed}</div>
                    <div className="text-sm text-gray-400">Delayed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{queueStats.completed}</div>
                    <div className="text-sm text-gray-400">Completed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-500">{queueStats.failed}</div>
                    <div className="text-sm text-gray-400">Failed</div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-sm text-gray-400 mb-1">
                    <span>Progress</span>
                    <span>{queueStats.total} total</span>
                  </div>
                  <Progress 
                    value={queueStats.total > 0 ? ((queueStats.completed + queueStats.failed) / queueStats.total) * 100 : 0} 
                    className="h-2"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Job Details Tab */}
        <TabsContent value="jobs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Job Details ({detailedJobs.length} total)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {detailedJobs.map((job) => (
                  <div key={job.id} className="border border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(job.status)}
                        <span className="font-medium">Job #{job.id}</span>
                        <Badge className={getStatusColor(job.status)}>
                          {job.status}
                        </Badge>
                      </div>
                      <span className="text-sm text-gray-400">
                        {formatTimestamp(job.created_date)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-400">Show</div>
                        <div className="font-medium">{job.show_title}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Episode</div>
                        <div className="font-medium">
                          S{job.season_number.toString().padStart(2, '0')}E{job.episode_number.toString().padStart(2, '0')} - {job.episode_title}
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <div className="text-gray-400">File Path</div>
                        <div className="font-mono text-xs bg-gray-800 p-2 rounded truncate">
                          {job.file_path}
                        </div>
                      </div>
                      {job.processing_notes && (
                        <div className="md:col-span-2">
                          <div className="text-gray-400">Notes</div>
                          <div className="text-sm bg-gray-800 p-2 rounded">
                            {job.processing_notes}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Issues Tab */}
        <TabsContent value="issues" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                System Issues ({jobStatus?.issues.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {jobStatus?.issues.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <p>No issues detected</p>
                  <p className="text-sm">All systems are running normally</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {jobStatus?.issues.map((issue, index) => (
                    <div key={index} className="border border-red-500/20 bg-red-500/10 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        {getIssueIcon(issue.type)}
                        <span className="font-medium capitalize">
                          {issue.type.replace(/_/g, ' ')}
                        </span>
                        {issue.count && (
                          <Badge variant="destructive">{issue.count}</Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-300 space-y-1">
                        {issue.queue && <div>Queue: {issue.queue}</div>}
                        {issue.jobId && <div>Job ID: {issue.jobId}</div>}
                        {issue.age && issue.threshold && (
                          <div>Age: {issue.age}s (threshold: {issue.threshold}s)</div>
                        )}
                        {issue.jobIds && (
                          <div>Affected Jobs: {issue.jobIds.join(', ')}</div>
                        )}
                        {issue.error && <div>Error: {issue.error}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPage; 