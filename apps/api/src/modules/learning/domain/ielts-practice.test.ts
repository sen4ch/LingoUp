import { describe, expect, it, vi } from 'vitest';
import type { Redis } from 'ioredis';
import type { AiGateway } from '../../ai-gateway/index.js';
import { readExamAudio } from '../infrastructure/exam-audio.js';
import type { UserSettingsQuery } from '../../identity/index.js';
import { ExamsService } from '../application/exams.service.js';
import type { PracticeEvents } from '../application/practice-events.service.js';
import {
  READING_QUESTIONS,
  LISTENING_QUESTIONS,
  TRANSCRIPTS,
  objectiveScore,
  practiceScore,
} from './ielts-practice.js';

describe('IELTS-style practice scoring', () => {
  it('ships a nonempty MP3 for every current listening transcript', async () => {
    for (const transcript of TRANSCRIPTS) {
      const audio = await readExamAudio(transcript);
      expect(audio.length).toBeGreaterThan(1000);
      expect(audio.length).toBeLessThan(1024 * 1024);
      // FFmpeg/PyAV emits an ID3 header or an MPEG frame sync.
      expect(audio.subarray(0, 3).toString() === 'ID3' || audio[0] === 0xff).toBe(true);
    }
  });
  it('scores objective answers against the key, including zero and perfect results', () => {
    expect(
      objectiveScore(
        READING_QUESTIONS.map((question) => question.answer),
        READING_QUESTIONS,
      ),
    ).toBe(10);
    expect(objectiveScore(Array<number>(10).fill(-1), READING_QUESTIONS)).toBe(0);
    expect(practiceScore(10, 10, 9, 9)).toBe(100);
    expect(practiceScore(0, 0, 0, 0)).toBe(0);
    expect(TRANSCRIPTS.every((text) => text.length <= 600)).toBe(true);
  });
  it('hides keys until completion, isolates users and returns a saved score on retry', async () => {
    const values = new Map<string, string>();
    const cache = {
      get: vi.fn((key: string) => Promise.resolve(values.get(key) ?? null)),
      set: vi.fn((key: string, value: string, ...options: unknown[]) => {
        if (options.includes('NX') && values.has(key)) return Promise.resolve(null);
        values.set(key, value);
        return Promise.resolve('OK');
      }),
      del: vi.fn((key: string) => Promise.resolve(Number(values.delete(key)))),
    } as unknown as Redis;
    const run = vi.fn().mockResolvedValue({
      status: 'ok',
      result: {
        provider: 'test-model',
        output: {
          writingTask1: { band: 6, feedback: 'Compare the main features.' },
          writingTask2: { band: 7.5, feedback: 'Develop your examples.' },
          speakingLanguage: { band: 7, feedback: 'Language estimate only.' },
        },
      },
    });
    const complete = vi.fn().mockResolvedValue(undefined);
    const service = new ExamsService(
      cache,
      { run } as unknown as AiGateway,
      {
        getForUser: () => Promise.resolve({ aiDataSharing: false }),
      } as unknown as UserSettingsQuery,
      { complete } as unknown as PracticeEvents,
    );
    const exam = await service.start('owner');
    expect(exam.readingQuestions[0]).not.toHaveProperty('answer');
    expect(exam).not.toHaveProperty('listeningTranscripts');
    await expect(service.get('another-user', exam.id)).rejects.toThrow();
    await expect(service.audio('another-user', exam.id, 0)).rejects.toThrow();
    expect(await service.audio('owner', exam.id, 0)).toEqual(await readExamAudio(TRANSCRIPTS[0]));
    const answers = {
      reading: READING_QUESTIONS.map((question) => question.answer),
      listening: LISTENING_QUESTIONS.map((question) => question.answer),
      writing: ['A report', 'An essay'] as [string, string],
      speaking: ['Part one', 'Part two', 'Part three'],
    };
    const result = await service.submit('owner', exam.id, answers);
    expect(result.reading).toBe(10);
    expect(result.listening).toBe(10);
    expect(result.writingBand).toBe(7);
    expect(result.score).toBe(practiceScore(10, 10, 7, 7));
    expect(await service.submit('owner', exam.id, answers)).toEqual(result);
    expect(run).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledTimes(4);
  });
});
