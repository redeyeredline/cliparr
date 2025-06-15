// src/middleware/cors.js
export default function cors(req, res, next) {
    res.header('Access-Control-Allow-Origin', 'http://localhost:8484');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  }
  