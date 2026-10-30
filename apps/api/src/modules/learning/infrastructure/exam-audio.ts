import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/** Content-addressed recordings cannot silently drift from the question-bank transcript. */
export async function readExamAudio(transcript: string): Promise<Buffer> {
  const filename = `${createHash('sha256').update(transcript).digest('hex')}.mp3`;
  // Production runs in /app; local workspace commands run from the root or apps/api.
  const roots = [path.resolve('content/exams/audio'), path.resolve('../../content/exams/audio')];
  for (const root of roots) {
    try {
      const data = await readFile(path.join(root, filename));
      if (!data.length || data.length > 1024 * 1024) throw new Error('Invalid exam recording');
      return data;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  throw new Error('Exam recording missing; run scripts/generate-exam-audio.mjs');
}
