import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ListeningAudioGateway } from '../../src/modules/ai-gateway/index.js';
import { createTestContext, TestAgent, type TestContext } from './harness.js';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestContext();
  vi.spyOn(ctx.app.get(ListeningAudioGateway), 'synthesize').mockResolvedValue({
    data: Buffer.from('test-mp3'),
    durationSeconds: 240,
  });
});
afterAll(async () => {
  await ctx.close();
});

describe('private listening lessons', () => {
  it('requires login, hides answers and grades against the stored lesson', async () => {
    const agent = new TestAgent(ctx.app);
    const body = { level: 'A1', topic: 'Town' };
    expect((await agent.request('POST', '/v1/learning/listening', body)).status).toBe(401);
    await agent.register();
    const generated = await agent.request('POST', '/v1/learning/listening', body);
    expect(generated.status).toBe(201);
    expect(generated.body.durationSeconds).toBe(240);
    expect(generated.body.questions).toHaveLength(5);
    expect(JSON.stringify(generated.body)).not.toMatch(/answerIndex|explanation|script|evidence/);
    const id = generated.body.id as string;
    expect((await agent.raw('GET', `/v1/learning/listening/${id}/audio`)).data.toString()).toBe(
      'test-mp3',
    );
    const answers = await agent.request('POST', `/v1/learning/listening/${id}/answers`, {
      answers: [0, 1, 0, 0, 0],
    });
    expect(answers.body).toMatchObject({ correct: 4, total: 5 });
    expect(answers.body.transcript).toContain('Nora works');
    expect(
      (
        await agent.request('POST', `/v1/learning/listening/${id}/answers`, {
          answers: [0, 0, 0, 0, 9],
        })
      ).status,
    ).toBe(400);
    const stranger = new TestAgent(ctx.app);
    await stranger.register();
    expect((await stranger.raw('GET', `/v1/learning/listening/${id}/audio`)).status).toBe(404);
    expect(
      (
        await stranger.request('POST', `/v1/learning/listening/${id}/answers`, {
          answers: [0, 0, 0, 0, 0],
        })
      ).status,
    ).toBe(404);
  });
  it('provides more questions at advanced levels', async () => {
    const agent = new TestAgent(ctx.app);
    await agent.register();
    const generated = await agent.request('POST', '/v1/learning/listening', {
      level: 'C2',
    });
    expect(generated.status).toBe(201);
    expect(generated.body.questions).toHaveLength(8);
  });
});
