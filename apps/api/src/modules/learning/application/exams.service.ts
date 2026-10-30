import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import {
  ExamSchema,
  ExamResultSchema,
  type Exam,
  type ExamAnswers,
  type ExamResult,
} from '@lingoup/contracts';
import { DomainError, notFound, VALKEY } from '../../../platform/index.js';
import { AiGateway, MOCK_PROVIDER_NAME } from '../../ai-gateway/index.js';
import { readExamAudio } from '../infrastructure/exam-audio.js';
import { UserSettingsQuery } from '../../identity/index.js';
import { PracticeEvents } from './practice-events.service.js';
import {
  READING,
  TRANSCRIPTS,
  READING_QUESTIONS,
  LISTENING_QUESTIONS,
  WRITING_TASKS,
  SPEAKING_TASKS,
  objectiveScore,
  practiceScore,
} from '../domain/ielts-practice.js';

@Injectable()
export class ExamsService {
  constructor(
    @Inject(VALKEY) private readonly cache: Redis,
    private readonly ai: AiGateway,
    private readonly settings: UserSettingsQuery,
    private readonly practice: PracticeEvents,
  ) {}
  private key(userId: string, id: string) {
    return `exams:v1:${userId}:${id}`;
  }
  async start(userId: string): Promise<Exam> {
    const exam: Exam = {
      id: randomUUID(),
      title: 'IELTS Academic — short practice',
      expiresAt: new Date(Date.now() + 86400_000).toISOString(),
      reading: READING.map((passage) => ({ ...passage })),
      readingQuestions: READING_QUESTIONS.map(({ answer: _answer, ...question }) => question),
      listeningQuestions: LISTENING_QUESTIONS.map(({ answer: _answer, ...question }) => question),
      writingTasks: [...WRITING_TASKS],
      speakingTasks: [...SPEAKING_TASKS],
    };
    await this.cache.set(
      this.key(userId, exam.id),
      JSON.stringify({ exam, result: null }),
      'EX',
      86400,
    );
    return exam;
  }
  async get(userId: string, id: string): Promise<{ exam: Exam; result: ExamResult | null }> {
    const saved = await this.cache.get(this.key(userId, id));
    if (!saved) throw notFound('Exam');
    const data = JSON.parse(saved) as { exam: unknown; result: unknown };
    return {
      exam: ExamSchema.parse(data.exam),
      result: data.result ? ExamResultSchema.parse(data.result) : null,
    };
  }
  async audio(userId: string, id: string, part: number) {
    await this.get(userId, id);
    const transcript = TRANSCRIPTS[part];
    if (!transcript) throw new DomainError('VALIDATION_FAILED', 'Invalid listening part');
    try {
      return await readExamAudio(transcript);
    } catch {
      throw new DomainError('AI_UNAVAILABLE', 'Exam recording unavailable. Please try again.');
    }
  }
  async submit(userId: string, id: string, answers: ExamAnswers): Promise<ExamResult> {
    const session = await this.get(userId, id);
    if (session.result) return session.result;
    for (const [selected, questions] of [
      [answers.reading, READING_QUESTIONS],
      [answers.listening, LISTENING_QUESTIONS],
    ] as const) {
      if (selected.some((answer, index) => answer >= questions[index]!.options.length))
        throw new DomainError('VALIDATION_FAILED', 'Invalid exam answer');
    }
    const key = this.key(userId, id);
    if (!(await this.cache.set(`${key}:checking`, '1', 'EX', 180, 'NX')))
      throw new DomainError(
        'AI_UNAVAILABLE',
        'Your exam is already being checked. Try again shortly.',
      );
    try {
      const settings = await this.settings.getForUser(userId);
      const assessment = await this.ai.run(
        'exam-assessment',
        {
          writingTasks: [...WRITING_TASKS],
          writing: answers.writing,
          speakingTasks: [...SPEAKING_TASKS],
          speaking: answers.speaking,
        },
        { userId, externalSharingConsent: settings.aiDataSharing },
      );
      if (assessment.status !== 'ok')
        throw new DomainError(
          'AI_UNAVAILABLE',
          'Exam assessment unavailable. Your answers have not been submitted.',
          { aiStatus: assessment.status },
        );
      const output = assessment.result.output;
      const isMock = assessment.result.provider === MOCK_PROVIDER_NAME;
      const writingBand =
        Math.round(((output.writingTask1.band + 2 * output.writingTask2.band) / 3) * 2) / 2;
      const reading = objectiveScore(answers.reading, READING_QUESTIONS);
      const listening = objectiveScore(answers.listening, LISTENING_QUESTIONS);
      const result: ExamResult = {
        id,
        completedAt: new Date().toISOString(),
        reading,
        listening,
        ...output,
        writingBand,
        isMock,
        score: isMock
          ? null
          : practiceScore(reading, listening, writingBand, output.speakingLanguage.band),
        readingAnswers: READING_QUESTIONS.map((question) => question.answer),
        listeningAnswers: LISTENING_QUESTIONS.map((question) => question.answer),
        listeningTranscripts: [...TRANSCRIPTS],
      };
      if (!isMock) {
        const passed = [
          ['reading', reading >= 6],
          ['listening', listening >= 6],
          ['writing', writingBand >= 5],
          ['speaking', output.speakingLanguage.band >= 5],
        ] as const;
        for (const [skill, success] of passed)
          if (success) await this.practice.complete(userId, skill, `exam:${id}:${skill}`);
      }
      const ttl = Math.max(1, Math.ceil((Date.parse(session.exam.expiresAt) - Date.now()) / 1000));
      await this.cache.set(key, JSON.stringify({ exam: session.exam, result }), 'EX', ttl);
      return result;
    } finally {
      await this.cache.del(`${key}:checking`);
    }
  }
}
