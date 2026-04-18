export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const RAPID_KEY = process.env.RAPIDAPI_KEY;
  if (!RAPID_KEY) return res.status(500).json({ error: 'API key not configured' });

  const { subject } = req.body;
  if (!subject) return res.status(400).json({ error: 'Missing subject' });

  const now = new Date();
  const transit_subject = {
    name: 'Now',
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    day: now.getUTCDate(),
    hour: now.getUTCHours(),
    minute: now.getUTCMinutes(),
    city: subject.city || 'London',
    nation: subject.nation || 'GB',
    longitude: subject.longitude || 0,
    latitude: subject.latitude || 51.5,
    timezone: subject.timezone || 'UTC',
  };

  const headers = {
    'Content-Type': 'application/json',
    'X-RapidAPI-Host': 'astrologer.p.rapidapi.com',
    'X-RapidAPI-Key': RAPID_KEY,
  };

  try {
    const resp = await fetch('https://astrologer.p.rapidapi.com/api/v5/context/transit', {
      method: 'POST',
      headers,
      body: JSON.stringify({ first_subject: subject, transit_subject }),
    });

    const data = await resp.json();
    return res.status(200).json({ context: data.context || data, timestamp: now.toISOString() });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
