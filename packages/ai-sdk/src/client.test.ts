import { describe, expect, it, vi } from 'vitest';
import { AiServiceClient, AiServiceError } from './client.js';

const input = {
  term: 'thrive',
  context: 'Plants thrive in sun.',
  learnerLevel: 'B1',
  nativeLanguage: 'ru',
} as const;

function clientReturning(response: Response) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
  return {
    client: new AiServiceClient({ baseUrl: 'http://ai:8000/', token: 'secret', fetch: fetchMock }),
    fetchMock,
  };
}

describe('AiServiceClient', () => {
  it('sends the service token and returns validated output', async () => {
    const { client, fetchMock } = clientReturning(
      Response.json({
        provider: 'ollama',
        model: 'qwen3:4b',
        output: {
          definition: 'to grow well',
          translation: 'процветать',
          partOfSpeech: 'verb',
          example: null,
          usageNote: null,
        },
      }),
    );
    const result = await client.runTask('word-explanation', input);
    expect(result.output.translation).toBe('процветать');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://ai:8000/v1/tasks/word-explanation');
    expect((init!.headers as Record<string, string>)['x-ai-service-token']).toBe('secret');
  });

  it('rejects output that does not match the task schema', async () => {
    const { client } = clientReturning(
      Response.json({ provider: 'x', model: 'y', output: { definition: '' } }),
    );
    await expect(client.runTask('word-explanation', input)).rejects.toBeInstanceOf(AiServiceError);
  });

  it('marks 5xx as retryable and 4xx as not', async () => {
    const server = clientReturning(new Response('boom', { status: 503 })).client;
    const badRequest = clientReturning(new Response('bad', { status: 422 })).client;
    await expect(server.runTask('word-explanation', input)).rejects.toMatchObject({
      retryable: true,
      status: 503,
    });
    await expect(badRequest.runTask('word-explanation', input)).rejects.toMatchObject({
      retryable: false,
      status: 422,
    });
  });
});
