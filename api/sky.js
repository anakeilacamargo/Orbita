export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const RAPID_KEY = process.env.RAPIDAPI_KEY;
  if (!RAPID_KEY) return res.status(500).json({ error: 'API key not configured' });
  const now = new Date();
  const subject = {
    name: 'Sky',
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    day: now.getUTCDate(),
    hour: now.getUTCHours(),
    minute: now.getUTCMinutes(),
    latitude: 0,
    longitude: 0,
    timezone: 'UTC',
    city: 'UTC',
  };
  const ACTIVE_POINTS = [
    'Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn',
    'Uranus','Neptune','Pluto','True_Node',
  ];
  const headers = {
    'Content-Type': 'application/json',
    'X-RapidAPI-Host': 'astrologer.p.rapidapi.com',
    'X-RapidAPI-Key': RAPID_KEY,
  };
  try {
    const resp = await fetch('https://astrologer.p.rapidapi.com/api/v5/context/birth-chart', {
      method: 'POST',
      headers,
      body: JSON.stringify({ subject, active_points: ACTIVE_POINTS }),
    });
    const data = await resp.json();
    const src = data?.context?.subject
      || data?.subject
      || data?.chart_data?.subject
      || data?.data?.subject
      || {};
    const PLANET_KEYS = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto','true_north_lunar_node','true_node'];
    const planets = PLANET_KEYS
      .map(k => src[k])
      .filter(Boolean)
      .map(p => {
        const absPos = p.abs_pos ?? p.position ?? null;
        const degInSign = absPos !== null ? absPos % 30 : null;
        return {
          name: p.name,
          sign: p.sign?.name || p.sign,
          abs_pos: absPos !== null ? parseFloat(absPos.toFixed(4)) : null,
          degree: degInSign !== null ? parseFloat(degInSign.toFixed(2)) : null,
          retrograde: p.retrograde || false,
        };
      });
    if (!planets.length) {
      return res.status(200).json({ planets: [], debug_keys: Object.keys(src), timestamp: now.toISOString() });
    }
    return res.status(200).json({ planets, timestamp: now.toISOString() });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
