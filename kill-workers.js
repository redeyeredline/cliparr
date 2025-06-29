#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function killWorkers() {
  console.log('Killing audio extraction and fingerprinting workers...');

  try {
    // Kill ffmpeg processes that are extracting audio for our app
    console.log('Killing ffmpeg audio extraction processes...');
    await execAsync('pkill -f "ffmpeg.*-vn.*-acodec pcm_s16le"');
    console.log('✅ ffmpeg audio extraction processes killed');
  } catch (error) {
    console.log('No ffmpeg audio extraction processes found');
  }

  try {
    // Kill ffmpeg chunk extraction processes
    console.log('Killing ffmpeg chunk extraction processes...');
    await execAsync('pkill -f "ffmpeg.*-ss.*-t.*chunk_"');
    console.log('✅ ffmpeg chunk extraction processes killed');
  } catch (error) {
    console.log('No ffmpeg chunk extraction processes found');
  }

  try {
    // Kill fpcalc fingerprinting processes
    console.log('Killing fpcalc fingerprinting processes...');
    await execAsync('pkill -f "fpcalc"');
    console.log('✅ fpcalc fingerprinting processes killed');
  } catch (error) {
    console.log('No fpcalc processes found');
  }

  console.log('All audio processing workers killed!');
}

killWorkers().catch(console.error);
