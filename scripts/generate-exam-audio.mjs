/** Rebuild original exam recordings with the existing local Piper voice (Node 24+). */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { TRANSCRIPTS } from '../apps/api/src/modules/learning/domain/ielts-practice.ts';

const destination = path.resolve(import.meta.dirname, '../content/exams/audio');
const recordings = JSON.parse(
  execFileSync(
    'docker',
    [
      'exec',
      '-i',
      'lingoup-ai-service-1',
      'python',
      '-c',
      'import sys,json,base64; from app.listening import synthesize_local,combine_audio,audio_duration; ' +
        'parts=json.load(sys.stdin); result=[]; ' +
        '\nfor text in parts:\n audio=combine_audio([synthesize_local(text,0.98)]); ' +
        'result.append({"audio":base64.b64encode(audio).decode(),"duration":audio_duration(audio)})' +
        '\nprint(json.dumps(result))',
    ],
    { input: JSON.stringify(TRANSCRIPTS), maxBuffer: 8 * 1024 * 1024, encoding: 'utf8' },
  ),
);
await mkdir(destination, { recursive: true });
for (const [index, text] of TRANSCRIPTS.entries()) {
  const recording = recordings[index];
  if (!recording || !Number.isFinite(recording.duration) || recording.duration <= 0)
    throw new Error(`Invalid recording for Part ${index + 1}`);
  const hash = createHash('sha256').update(text).digest('hex');
  const data = Buffer.from(recording.audio, 'base64');
  if (!data.length || data.length > 1024 * 1024) throw new Error('Invalid recording size');
  await writeFile(path.join(destination, `${hash}.mp3`), data);
  process.stdout.write(
    `Part ${index + 1}: ${recording.duration.toFixed(1)} s, ${data.length} bytes\n`,
  );
}
