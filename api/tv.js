// Vercel serverless function — proxies TradingView scanner POST requests server-side.
// Browser → /api/tv (POST) → this function → scanner.tradingview.com (no CORS).
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const bodyStr = typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body);

    const upstream = await fetch('https://scanner.tradingview.com/indonesia/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: bodyStr,
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
