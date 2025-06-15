// src/config/index.js
import dotenv from 'dotenv';
dotenv.config();

// required env vars
const required = ['SONARR_API_KEY'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  throw new Error(`Missing ENV vars: ${missing.join(', ')}`);
}

export const PORT = parseInt(process.env.PORT, 10) || 8485;
export const HOST = process.env.HOST || '0.0.0.0';
export const SONARR_API_KEY = process.env.SONARR_API_KEY;
// Base URL for your Sonarr instance (fallback to localhost)
export const SONARR_URL = process.env.SONARR_URL || 'http://localhost:8989';