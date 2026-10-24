import http from 'node:http';

const PORT = Number(process.env.FAKE_GEMINI_PORT || process.env.PORT || 54399);

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', service: 'fake-gemini' }));
  }

  if (req.method === 'POST' && url.pathname.includes(':generateContent')) {
    let bodyText = '';
    for await (const chunk of req) {
      bodyText += chunk;
    }

    try {
      const body = JSON.parse(bodyText);
      const { contents = [], system_instruction } = body;

      // Check if there is a functionResponse in any turn
      let functionResponsePart = null;
      for (const turn of contents) {
        if (Array.isArray(turn.parts)) {
          for (const part of turn.parts) {
            if (part.functionResponse) {
              functionResponsePart = part.functionResponse;
            }
          }
        }
      }

      // Step 2 of function calling: Gemini receives function output and crafts natural language reply
      if (functionResponsePart) {
        const { name, response } = functionResponsePart;
        if (name === 'get_mass_schedule') {
          const schedules = response?.schedules || [];
          let replyText = '';
          if (schedules.length === 0) {
            replyText = 'There are no scheduled Masses posted for this parish at the moment.';
          } else {
            const list = schedules
              .map(
                (s) =>
                  `• ${s.day_of_week} at ${s.time}${s.language ? ` (${s.language})` : ''}`
              )
              .join('\n');
            replyText = `Here is the current Mass schedule:\n${list}`;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    role: 'model',
                    parts: [{ text: replyText }],
                  },
                  finishReason: 'STOP',
                },
              ],
            })
          );
        }
      }

      // Step 1: Check if user is asking about Mass times/schedules
      const userText = contents
        .filter((c) => c.role === 'user')
        .flatMap((c) => c.parts || [])
        .map((p) => p.text || '')
        .join(' ');

      const isMassQuery =
        /mass/i.test(userText) ||
        /schedule/i.test(userText) ||
        /misa/i.test(userText) ||
        /oras/i.test(userText);

      if (isMassQuery) {
        const systemText = system_instruction?.parts?.[0]?.text || '';
        const match = systemText.match(/parish ID:\s*([a-f0-9-]+)/i);
        const churchId = match ? match[1] : '';

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [
                    {
                      functionCall: {
                        name: 'get_mass_schedule',
                        args: {
                          church_id: churchId,
                        },
                      },
                    },
                  ],
                },
                finishReason: 'STOP',
              },
            ],
          })
        );
      }

      // Default conversational response
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(
        JSON.stringify({
          candidates: [
            {
              content: {
                role: 'model',
                parts: [
                  {
                    text: 'Hello! I am your Sacralink Parish Assistant. How can I assist you with parish schedules or sacrament bookings today?',
                  },
                ],
              },
              finishReason: 'STOP',
            },
          ],
        })
      );
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Invalid JSON', details: err.message }));
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[fake-gemini] Server listening on http://0.0.0.0:${PORT}`);
});
