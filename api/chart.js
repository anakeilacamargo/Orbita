// /api/chart.js — fetches birth chart + context in parallel
// Keys live in Vercel Environment Variables, never exposed to frontend

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const RAPID_KEY = process.env.RAPIDAPI_KEY;
  if (!RAPID_KEY) return res.status(500).json({ error: 'API key not configured' });

  const { subject } = req.body;
  if (!subject) return res.status(400).json({ error: 'Missing subject' });

  const ACTIVE_POINTS = [
    "Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn",
    "Uranus","Neptune","Pluto","Chiron","True_Node","Ascendant","Medium_Coeli","Lilith"
  ];

  const headers = {
    'Content-Type': 'application/json',
    'X-RapidAPI-Host': 'astrologer.p.rapidapi.com',
    'X-RapidAPI-Key': RAPID_KEY,
  };

  try {
    // Fetch chart + context in parallel
    const [chartResp, ctxResp] = await Promise.all([
      fetch('https://astrologer.p.rapidapi.com/api/v5/chart/birth-chart', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          subject,
          theme: 'dark',
          transparent_background: true,
          active_points: ACTIVE_POINTS,
        }),
      }),
      fetch('https://astrologer.p.rapidapi.com/api/v5/context/birth-chart', {
        method: 'POST',
        headers,
        body: JSON.stringify({ subject, active_points: ACTIVE_POINTS }),
      }),
    ]);

    const [chartData, ctxData] = await Promise.all([chartResp.json(), ctxResp.json()]);

    if (chartData.status !== 'OK') {
      return res.status(400).json({ error: 'Astrologer API error', detail: chartData });
    }

    return res.status(200).json({
      chart_data: chartData.chart_data,
      context: ctxData.context || '',
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
