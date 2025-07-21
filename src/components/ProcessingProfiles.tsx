import React, { useState } from 'react';
import type { ProcessingProfile } from '@/components/entities/ProcessingProfile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Settings, Plus, Zap, Monitor } from 'lucide-react';

// Define the hardware info type
interface HardwareInfo {
  nvenc_support?: boolean;
  qsv_support?: boolean;
  vce_support?: boolean;
}

interface ProcessingProfilesProps {
  profiles: ProcessingProfile[];
  hardwareInfo: HardwareInfo | null;
  onRefresh: () => void;
}

export default function ProcessingProfiles({
  profiles,
  hardwareInfo,
  onRefresh,
}: ProcessingProfilesProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newProfile, setNewProfile] = useState<Omit<ProcessingProfile, 'id'>>({
    name: '',
    description: '',
    video_codec: 'h264',
    audio_codec: 'aac',
    container: 'mp4',
    quality_preset: 'medium',
    hardware_acceleration: 'none',
    target_bitrate: 2000,
    max_resolution: 'original',
  });

  const handleCreateProfile = async () => {
    // TODO: Replace with actual create logic
    setShowCreateDialog(false);
    setNewProfile({
      name: '',
      description: '',
      video_codec: 'h264',
      audio_codec: 'aac',
      container: 'mp4',
      quality_preset: 'medium',
      hardware_acceleration: 'none',
      target_bitrate: 2000,
      max_resolution: 'original',
    });
    onRefresh();
  };

  const getRecommendedHardwareAcceleration = (): string[] => {
    if (!hardwareInfo) {
      return ['none'];
    }
    const options = ['none'];
    if (hardwareInfo.nvenc_support) {
      options.push('nvidia_nvenc');
    }
    if (hardwareInfo.qsv_support) {
      options.push('intel_qsv');
    }
    if (hardwareInfo.vce_support) {
      options.push('amd_vce');
    }
    return options;
  };

  const getHardwareAccelerationBadge = (acceleration: string): string => {
    const colors: Record<string, string> = {
      none: 'bg-slate-100 text-slate-700',
      nvidia_nvenc: 'bg-green-100 text-green-700',
      intel_qsv: 'bg-blue-100 text-blue-700',
      amd_vce: 'bg-red-100 text-red-700',
      vaapi: 'bg-purple-100 text-purple-700',
    };
    return colors[acceleration] || colors.none;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-white" />
            <CardTitle className="text-xl font-bold text-white">Processing Profiles</CardTitle>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gray-700/60 text-white hover:bg-gray-700/80">
                <Plus className="w-4 h-4 mr-2" />
                Create Profile
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-white">Create Processing Profile</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Profile Name</Label>
                    <Input
                      value={newProfile.name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setNewProfile({ ...newProfile, name: e.target.value })
                      }
                      placeholder="High Quality NVENC"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Container Format</Label>
                    <Select
                      value={newProfile.container}
                      onValueChange={(value: string) =>
                        setNewProfile({ ...newProfile, container: value as 'mp4' | 'mkv' | 'avi' })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mp4">MP4</SelectItem>
                        <SelectItem value="mkv">MKV</SelectItem>
                        <SelectItem value="avi">AVI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={newProfile.description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setNewProfile({ ...newProfile, description: e.target.value })
                    }
                    placeholder="Optimized for high quality with NVIDIA hardware acceleration"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Video Codec</Label>
                    <Select
                      value={newProfile.video_codec}
                      onValueChange={(value: string) =>
                        setNewProfile({
                          ...newProfile,
                          video_codec: value as 'h264' | 'h265' | 'av1' | 'copy',
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="h264">H.264</SelectItem>
                        <SelectItem value="h265">H.265/HEVC</SelectItem>
                        <SelectItem value="av1">AV1</SelectItem>
                        <SelectItem value="copy">Copy (No Re-encode)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Audio Codec</Label>
                    <Select
                      value={newProfile.audio_codec}
                      onValueChange={(value: string) =>
                        setNewProfile({
                          ...newProfile,
                          audio_codec: value as 'aac' | 'ac3' | 'copy',
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aac">AAC</SelectItem>
                        <SelectItem value="ac3">AC3</SelectItem>
                        <SelectItem value="copy">Copy</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Hardware Acceleration</Label>
                    <Select
                      value={newProfile.hardware_acceleration}
                      onValueChange={(value: string) =>
                        setNewProfile({
                          ...newProfile,
                          hardware_acceleration: value as
                            | 'none'
                            | 'nvidia_nvenc'
                            | 'intel_qsv'
                            | 'amd_vce'
                            | 'vaapi',
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getRecommendedHardwareAcceleration().map((option) => (
                          <SelectItem key={option} value={option}>
                            {option.replace(/_/g, ' ').toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Quality Preset</Label>
                    <Select
                      value={newProfile.quality_preset}
                      onValueChange={(value: string) =>
                        setNewProfile({
                          ...newProfile,
                          quality_preset: value as
                            | 'ultrafast'
                            | 'superfast'
                            | 'veryfast'
                            | 'faster'
                            | 'fast'
                            | 'medium'
                            | 'slow'
                            | 'slower'
                            | 'veryslow',
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ultrafast">Ultra Fast</SelectItem>
                        <SelectItem value="veryfast">Very Fast</SelectItem>
                        <SelectItem value="fast">Fast</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="slow">Slow</SelectItem>
                        <SelectItem value="veryslow">Very Slow</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateProfile}>Create Profile</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {/* Empty state if no profiles */}
        {(!profiles || profiles.length === 0) && (
          <div className="flex flex-col items-center justify-center py-12">
            <Monitor className="w-16 h-16 mb-4 text-gray-400" />
            <h3 className="font-semibold text-gray-200 mb-2 text-lg">No Processing Profiles</h3>
            <p className="text-gray-400 mb-4">
              Create custom profiles for different quality and performance needs
            </p>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-gray-700/60 text-white hover:bg-gray-700/80"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Profile
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
