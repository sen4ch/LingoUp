// Controlled model-server fixture for installation tests. Never downloads a model.
const http = require('node:http');
const models = new Set();
http
  .createServer((request, response) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      response.setHeader('content-type', 'application/json');
      if (request.url === '/api/tags')
        return response.end(JSON.stringify({ models: [...models].map((name) => ({ name })) }));
      if (request.url === '/api/pull') {
        const body = JSON.parse(Buffer.concat(chunks).toString());
        models.add(body.model);
        return response.end(
          '{"status":"pulling","completed":10,"total":10}\n{"status":"success"}\n',
        );
      }
      if (request.url === '/v1/models' || request.url === '/models') {
        if (request.headers.authorization !== 'Bearer qa-test-key') {
          response.statusCode = 401;
          return response.end('{"error":"Invalid key"}');
        }
        return response.end(JSON.stringify({ data: [{ id: 'qa-model' }] }));
      }
      if (request.url === '/api/generate') return response.end('{"done":true}');
      if (request.url === '/v1/messages') {
        if (request.headers['x-api-key'] !== 'qa-test-key') {
          response.statusCode = 401;
          return response.end('{}');
        }
        return response.end(
          JSON.stringify({
            stop_reason: 'end_turn',
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  definition: 'To grow and develop well.',
                  translation: 'To flourish',
                  partOfSpeech: 'verb',
                  example: 'Plants thrive in sunlight.',
                  usageNote: 'A positive word for healthy growth.',
                }),
              },
            ],
          }),
        );
      }
      if (request.url === '/api/chat')
        return response.end(JSON.stringify({ message: { content: '{}' }, done: true }));
      response.statusCode = 404;
      response.end('{}');
    });
  })
  .listen(11434, '0.0.0.0');
