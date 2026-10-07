const BACKEND = process.env.BACKEND_URL || 'http://13.53.153.117:8000';

export default async function handler(req, res) {
  const backendUrl = `${BACKEND}${req.url}`;

  const headers = {};
  if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
  if (req.headers['authorization']) headers['authorization'] = req.headers['authorization'];
  if (req.headers['accept']) headers['accept'] = req.headers['accept'];

  const fetchOpts = { method: req.method, headers };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    fetchOpts.body = JSON.stringify(req.body);
  }

  try {
    const response = await fetch(backendUrl, fetchOpts);

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('text/event-stream')) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value, { stream: true }));
        }
      } catch {
        // client disconnected
      }
      res.end();
    } else {
      const data = await response.text();
      res.status(response.status);
      res.setHeader('Content-Type', contentType);
      res.send(data);
    }
  } catch (err) {
    res.status(502).json({ detail: 'Backend unavailable' });
  }
}
