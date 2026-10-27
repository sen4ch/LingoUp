import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, TestAgent, type TestContext } from './harness.js';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => {
  await ctx.close();
});

const png = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 30, g: 90, b: 160 } } })
    .png()
    .toBuffer();

async function agentWithWord(term: string) {
  const agent = new TestAgent(ctx.app);
  await agent.register();
  const saved = await agent.request('POST', '/v1/vocabulary/words', {
    term,
    translation: 'квартира',
  });
  expect(saved.status).toBe(201);
  expect(saved.body.image).toBeNull();
  return { agent, wordId: saved.body.id as string };
}

describe('word images', () => {
  it('stores an uploaded picture as WebP and shows it in the word, reviews and export', async () => {
    const { agent, wordId } = await agentWithWord('flat');
    const upload = await agent.raw('PUT', `/v1/vocabulary/words/${wordId}/image/upload`, {
      data: await png(1600, 1200),
      contentType: 'image/png',
    });
    expect(upload.status).toBe(200);
    expect(JSON.parse(upload.data.toString())).toMatchObject({ source: 'upload', license: null });

    const image = await agent.raw('GET', `/v1/vocabulary/words/${wordId}/image`);
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toBe('image/webp');
    const meta = await sharp(image.data).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', 640, 480]);

    const word = await agent.request('GET', `/v1/vocabulary/words/${wordId}`);
    expect(word.body.image).toMatchObject({ source: 'upload' });
    const due = await agent.request('GET', '/v1/vocabulary/reviews/due');
    expect(due.body.cards[0].image).toMatchObject({ source: 'upload' });
    const exported = await agent.request('GET', '/v1/me/export');
    expect(exported.body.sections.vocabulary.images).toEqual([
      { wordId, dataUrl: expect.stringMatching(/^data:image\/webp;base64,/) },
    ]);

    // Replacing keeps one picture per word.
    const again = await agent.raw('PUT', `/v1/vocabulary/words/${wordId}/image/upload`, {
      data: await png(50, 50),
      contentType: 'image/png',
    });
    expect(again.status).toBe(200);
    const small = await sharp(
      (await agent.raw('GET', `/v1/vocabulary/words/${wordId}/image`)).data,
    ).metadata();
    expect([small.width, small.height]).toEqual([50, 50]);

    expect((await agent.request('DELETE', `/v1/vocabulary/words/${wordId}/image`)).status).toBe(
      204,
    );
    expect((await agent.raw('GET', `/v1/vocabulary/words/${wordId}/image`)).status).toBe(404);
  });

  it('keeps pictures private and rejects files that are not images', async () => {
    const { agent, wordId } = await agentWithWord('bargain');
    const upload = (data: Buffer, contentType: string, as = agent) =>
      as.raw('PUT', `/v1/vocabulary/words/${wordId}/image/upload`, { data, contentType });

    const fake = await upload(Buffer.from('<svg onload="alert(1)"/>'), 'image/png');
    expect(fake.status).toBe(422);
    expect(JSON.parse(fake.data.toString()).error.code).toBe('IMAGE_INVALID');
    expect((await upload(Buffer.from('<svg/>'), 'image/svg+xml')).status).toBe(415);

    expect((await upload(await png(10, 10), 'image/png')).status).toBe(200);
    const stranger = new TestAgent(ctx.app);
    await stranger.register();
    expect((await stranger.raw('GET', `/v1/vocabulary/words/${wordId}/image`)).status).toBe(404);
    expect((await upload(await png(10, 10), 'image/png', stranger)).status).toBe(404);
  });

  it('reports image search as unavailable when it is not enabled', async () => {
    const { agent } = await agentWithWord('crowded');
    const search = await agent.request('GET', '/v1/vocabulary/images/search?q=crowded');
    expect(search.status).toBe(503);
    expect(search.body.error.code).toBe('IMAGE_SEARCH_UNAVAILABLE');
  });
});
