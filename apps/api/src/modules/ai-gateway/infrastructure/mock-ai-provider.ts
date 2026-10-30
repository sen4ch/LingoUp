import {
  GAP,
  type AiTaskInput,
  type AiTaskOutput,
  type AiTaskResult,
  type AiTaskType,
  type ImplementedAiTaskType,
} from '@lingoup/ai-sdk';
import type { AIProvider, DataLocality } from '../application/ai-provider.js';

export const MOCK_PROVIDER_NAME = 'mock';

const SUPPORTED: readonly AiTaskType[] = [
  'exam-assessment',
  'writing-assessment',
  'speaking-tutor',
  'listening-generation',
  'word-explanation',
  'reading-text-generation',
  'exercise-generation',
];

/**
 * Deterministic placeholder that lets the platform run without any model. Its output
 * is explicitly labelled as a placeholder (and flagged `isMock` in the API); it never
 * pretends to be real model output.
 */
export class MockAIProvider implements AIProvider {
  readonly name = MOCK_PROVIDER_NAME;

  dataLocality(): Promise<DataLocality> {
    return Promise.resolve('local');
  }

  supports(task: AiTaskType): boolean {
    return SUPPORTED.includes(task);
  }

  execute<T extends ImplementedAiTaskType>(
    task: T,
    input: AiTaskInput<T>,
    signal: AbortSignal,
  ): Promise<AiTaskResult<T>> {
    signal.throwIfAborted();
    return Promise.resolve({
      provider: this.name,
      model: 'mock-v1',
      output: this.output(task, input) as AiTaskOutput<T>,
    });
  }

  private output(task: ImplementedAiTaskType, input: unknown): unknown {
    switch (task) {
      case 'exam-assessment': {
        const review = { band: 0, feedback: 'Demo only. Configure a real AI provider for an assessment.' };
        return { writingTask1: review, writingTask2: review, speakingLanguage: review };
      }
      case 'writing-assessment': {
        const { level, topic, messages } = input as AiTaskInput<'writing-assessment'>;
        return {
          subject: `Practice email: ${topic}`,
          reply: messages.length
            ? 'Hi again,\n\nThank you for your email. What would you like to do next weekend? Tell me about your plans.\n\nBest,\nAlex'
            : `Hi,\n\nLet's exchange emails about ${topic}. What do you enjoy doing in your free time?\n\nBest,\nAlex`,
          feedback: `Demo only (${level}): no language model is configured, so your writing has not been assessed.`,
          issues: [],
        };
      }
      case 'listening-generation': {
        const { level } = input as AiTaskInput<'listening-generation'>;
        return {
          title: 'Placeholder listening lesson',
          script:
            'Nora works at the library in a small town near the sea. She takes the bus to work every Monday because she wants to save money. She organises a book club with a new volunteer. '.repeat(
              16,
            ),
          questions: Array.from(
            { length: ['A1', 'A2'].includes(level) ? 5 : ['B1', 'B2'].includes(level) ? 6 : 8 },
            (_, index) => ({
              question: `Question ${index + 1}: Where does Nora work?`,
              options: ['At the library', 'At a station', 'At a museum', 'At an office'],
              answerIndex: 0,
              explanation: 'The narrator describes Nora at the library.',
              evidence: 'Nora works at the library',
              kind: 'inference',
            }),
          ),
        };
      }
      case 'speaking-tutor':
        return {
          reply:
            'Hello! I am your practice teacher. Tell me about your day. What did you do this morning?',
        };
      case 'word-explanation': {
        const { term, context } = input as AiTaskInput<'word-explanation'>;
        return {
          definition: `Placeholder for "${term}": no language model is configured. Set AI_PROVIDER=ai-service to get real explanations.`,
          translation: null,
          partOfSpeech: null,
          example: context.trim() || null,
          usageNote: null,
        };
      }
      case 'reading-text-generation': {
        const { words } = input as AiTaskInput<'reading-text-generation'>;
        return {
          title: 'Placeholder practice text',
          summary: 'Generated without a language model. Configure an AI provider for real texts.',
          paragraphs: [
            'This is a placeholder text. No language model is configured, so these sentences only show where your words would appear.',
            ...Array.from({ length: Math.ceil(words.length / 10) }, (_, index) =>
              words
                .slice(index * 10, (index + 1) * 10)
                .map((word) => `Here is the word "${word}" in a placeholder sentence.`)
                .join(' '),
            ),
          ],
        };
      }
      case 'exercise-generation': {
        const { words } = input as AiTaskInput<'exercise-generation'>;
        return {
          items: words.map(({ term, definition }) => ({
            term,
            sentence: `Placeholder sentence without a language model: ${GAP}.`,
            hint: definition,
          })),
        };
      }
    }
  }
}
