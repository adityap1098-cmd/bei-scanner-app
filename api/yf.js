// Vercel serverless function — proxies Yahoo Finance requests server-side.
// Browser → /api/yf?url=... → this function → Yahoo Finance (no CORS).
const ALLOWED_HOSTS = new Set([
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
]);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url param' });

  let parsed;
  try { parsed = new URL(url); }
  catch { return res.status(400).json({ error: 'Invalid url' }); }

  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return res.status(403).json({ error: 'Forbidden host' });
  }

  try {
    const upstream = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
