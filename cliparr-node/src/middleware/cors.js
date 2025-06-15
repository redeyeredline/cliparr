// src/middleware/cors.js
import config from '../config/app.js';

export default function cors(req, res, next) {
  const { cors: corsConfig } = config;

  res.header('Access-Control-Allow-Origin', corsConfig.origin);
  res.header('Access-Control-Allow-Methods', corsConfig.methods.join(','));
  res.header('Access-Control-Allow-Headers', corsConfig.headers.join(','));
  res.header('Access-Control-Allow-Credentials', corsConfig.credentials.toString());

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
}
