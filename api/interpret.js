export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'API key not configured' });

  const { system, userMessage, maxTokens } = req.body;
  if (!system || !userMessage) return res.status(400).json({ error: 'Missing system or userMessage' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
       model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens || 2000,
        system,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'Anthropic error' });
    if (!data.content || !data.content[0]) return res.status(500).json({ error: 'Empty response' });

    return res.status(200).json({ text: data.content[0].text });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
