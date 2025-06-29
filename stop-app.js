#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function stopApp() {
  console.log('Stopping all application processes...');

  try {
    // Stop Vite processes
    console.log('Stopping Vite processes...');
    await execAsync('pkill -f "vite"');
    console.log('✅ Vite processes stopped');
  } catch (error) {
    console.log('No Vite processes found or already stopped');
  }

  try {
    // Stop Node.js app processes (but not Cursor/VS Code processes)
    console.log('Stopping Node.js app processes...');
    await execAsync('pkill -f "node.*app.js"');
    await execAsync('pkill -f "node.*server.js"');
    console.log('✅ Node.js app processes stopped');
  } catch (error) {
    console.log('No Node.js app processes found or already stopped');
  }

  try {
    // Stop any remaining workers
    console.log('Stopping any remaining workers...');
    await execAsync('pkill -f "episode-processing"');
    await execAsync('pkill -f "audio-extraction"');
    await execAsync('pkill -f "fingerprinting"');
    await execAsync('pkill -f "detection"');
    await execAsync('pkill -f "trimming"');
    console.log('✅ Worker processes stopped');
  } catch (error) {
    console.log('No worker processes found or already stopped');
  }

  console.log('Application stopped successfully!');
}

stopApp().catch(console.error);
