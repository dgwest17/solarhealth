/**
 * Vercel Serverless Function — Anthropic API proxy
 * Keeps ANTHROPIC_API_KEY server-side (never shipped to the browser).
 *
 * Setup: In Vercel → Project → Settings → Environment Variables, add:
 *   ANTHROPIC_API_KEY = sk-ant-...   (NO "VITE_" prefix — that would expose it)
 *
 * Deploys automatically: any file in /api becomes an endpoint at /api/<name>.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY is not configured in Vercel environment variables.'
    });
  }

  const { system, prompt } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt in request body.' });
  }

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text();
      console.error('Anthropic API error:', anthropicRes.status, errBody);
      return res.status(anthropicRes.status).json({
        error: `Anthropic API returned ${anthropicRes.status}`
      });
    }

    const data = await anthropicRes.json();
    const text = (data.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    return res.status(200).json({ text });
  } catch (err) {
    console.error('Narrative generation failed:', err);
    return res.status(500).json({ error: 'Failed to generate narrative.' });
  }
}
