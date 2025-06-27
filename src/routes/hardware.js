// Hardware detection routes for system information and capabilities
// Provides endpoints to detect GPU, CPU, memory, and FFmpeg support
import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);
const router = express.Router();

// GET hardware information
router.get('/detect', async (req, res) => {
  const logger = req.app.get('logger');

  try {
    logger.info('Hardware detection requested');

    const hardwareInfo = await detectHardware();

    res.json({
      status: 'success',
      data: hardwareInfo,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Hardware detection failed:', error);
    res.status(500).json({
      status: 'error',
      error: 'Hardware detection failed',
      details: error.message,
    });
  }
});

// GET current hardware info (cached/previous detection)
router.get('/info', async (req, res) => {
  const logger = req.app.get('logger');

  try {
    logger.info('Hardware info requested');

    // For now, we'll detect fresh each time
    // In the future, this could be cached in the database
    const hardwareInfo = await detectHardware();

    res.json({
      status: 'success',
      data: hardwareInfo,
    });
  } catch (error) {
    logger.error('Failed to get hardware info:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to get hardware info',
      details: error.message,
    });
  }
});

async function detectHardware() {
  const hardwareInfo = {
    gpu_name: null,
    cpu_name: null,
    cpu_cores: os.cpus().length,
    memory_gb: Math.round(os.totalmem() / (1024 * 1024 * 1024)),
    ffmpeg_version: null,
    nvenc_support: false,
    qsv_support: false,
    last_detected: new Date().toISOString(),
  };

  try {
    // Detect GPU
    hardwareInfo.gpu_name = await detectGPU();

    // Detect CPU name
    hardwareInfo.cpu_name = await detectCPU();

    // Detect FFmpeg version and capabilities
    const ffmpegInfo = await detectFFmpeg();
    hardwareInfo.ffmpeg_version = ffmpegInfo.version;
    hardwareInfo.nvenc_support = ffmpegInfo.nvenc_support;
    hardwareInfo.qsv_support = ffmpegInfo.qsv_support;
  } catch (error) {
    console.error('Error during hardware detection:', error);
  }

  return hardwareInfo;
}

async function detectGPU() {
  try {
    // Try to detect NVIDIA GPU first
    const { stdout: nvidiaOutput } = await execAsync('nvidia-smi --query-gpu=name --format=csv,noheader,nounits 2>/dev/null || echo ""');
    if (nvidiaOutput.trim()) {
      return nvidiaOutput.trim();
    }

    // Try to detect GPU via lspci
    const { stdout: lspciOutput } = await execAsync('lspci | grep -i "vga|3d|display" | head -1 2>/dev/null || echo ""');
    if (lspciOutput.trim()) {
      // Extract GPU name from lspci output
      const match = lspciOutput.match(/:\s*(.+)$/);
      return match ? match[1].trim() : lspciOutput.trim();
    }

    // Try to detect via /proc/gpuinfo (for some systems)
    try {
      const { stdout: gpuinfoOutput } = await execAsync('cat /proc/gpuinfo 2>/dev/null | grep "Model" | head -1 || echo ""');
      if (gpuinfoOutput.trim()) {
        const match = gpuinfoOutput.match(/Model:\s*(.+)$/);
        return match ? match[1].trim() : null;
      }
    } catch (e) {
      // Ignore errors for this method
    }

    return null;
  } catch (error) {
    console.error('GPU detection failed:', error);
    return null;
  }
}

async function detectCPU() {
  try {
    // Try to get CPU info from /proc/cpuinfo
    const { stdout: cpuinfoOutput } = await execAsync('cat /proc/cpuinfo 2>/dev/null | grep "model name" | head -1 || echo ""');
    if (cpuinfoOutput.trim()) {
      const match = cpuinfoOutput.match(/model name\s*:\s*(.*)/i);
      return match ? match[1].trim() : null;
    }

    // Fallback: try lscpu
    const { stdout: lscpuOutput } = await execAsync('lscpu 2>/dev/null | grep "Model name" | head -1 || echo ""');
    if (lscpuOutput.trim()) {
      const match = lscpuOutput.match(/Model name:\s*(.*)/i);
      return match ? match[1].trim() : null;
    }

    // Fallback: try sysctl on macOS
    try {
      const { stdout: sysctlOutput } = await execAsync('sysctl -n machdep.cpu.brand_string 2>/dev/null || echo ""');
      if (sysctlOutput.trim()) {
        return sysctlOutput.trim();
      }
    } catch (e) {
      // Ignore errors for this method
    }

    return null;
  } catch (error) {
    console.error('CPU detection failed:', error);
    return null;
  }
}

async function detectFFmpeg() {
  const result = {
    version: null,
    nvenc_support: false,
    qsv_support: false,
  };

  try {
    // Get FFmpeg version
    const { stdout: versionOutput } = await execAsync('ffmpeg -version 2>/dev/null | head -1 || echo ""');
    if (versionOutput.trim()) {
      const versionMatch = versionOutput.match(/ffmpeg version ([^\s]+)/);
      result.version = versionMatch ? versionMatch[1] : null;
    }

    // Test NVENC support by actually trying to encode
    try {
      await execAsync('ffmpeg -f lavfi -i testsrc=duration=1:size=320x240:rate=1 -c:v h264_nvenc -t 1 -f null - 2>/dev/null');
      result.nvenc_support = true;
    } catch (e) {
      result.nvenc_support = false;
    }

    // Test QSV support by actually trying to encode
    try {
      await execAsync('ffmpeg -f lavfi -i testsrc=duration=1:size=320x240:rate=1 -c:v h264_qsv -t 1 -f null - 2>/dev/null');
      result.qsv_support = true;
    } catch (e) {
      result.qsv_support = false;
    }

  } catch (error) {
    console.error('FFmpeg detection failed:', error);
  }

  return result;
}

export default router;
