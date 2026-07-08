// Vercel serverless equivalent of server.js's /api/claude proxy — deploy this
// project to Vercel to host the AI proxy (server.js is for local dev only).

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim());

// Best-effort only: resets whenever Vercel spins up a new instance.
const requestLog = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 100;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = requestLog.get(ip);
  if (!entry || now - entry.start > WINDOW_MS) {
    requestLog.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_REQUESTS;
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    res.status(429).json({ error: 'Too many requests, please try again later.' });
    return;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: req.body.model || 'claude-3-5-sonnet-latest',
        max_tokens: Math.min(req.body.max_tokens || 1024, 4096),
        system: req.body.system || 'You are a helpful assistant.',
        messages: req.body.messages || []
      })
    });
    const data = await response.json();
    if (!response.ok) {
      res.status(response.status).json(data);
      return;
    }
    res.status(200).json(data);
  } catch (error) {
    console.error('Error proxying to Anthropic:', error);
    res.status(500).json({ error: 'Failed to communicate with Anthropic API' });
  }
}
