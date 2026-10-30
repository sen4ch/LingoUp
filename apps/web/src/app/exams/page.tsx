'use client';

import { useRef, useState } from 'react';
import { ExamSchema, ExamResultSchema, type Exam, type ExamResult } from '@lingoup/contracts';
import { Alert, Button, Card, Skeleton } from '@lingoup/ui';
import { api } from '@/lib/api-client';
import { useRequireUser } from '@/lib/auth';
import { ExamRecorder } from '@/components/exam-recorder';
import { ExamAudio } from '@/components/exam-audio';

const STEPS = ['Listening', 'Reading', 'Writing', 'Speaking'];
const words = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

export default function ExamsPage() {
  const { user, isLoading } = useRequireUser();
  const [exam, setExam] = useState<Exam | null>(null);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [step, setStep] = useState(0);
  const [reading, setReading] = useState<number[]>(Array<number>(10).fill(-1));
  const [listening, setListening] = useState<number[]>(Array<number>(10).fill(-1));
  const [writing, setWriting] = useState(['', '']);
  const [speaking, setSpeaking] = useState(['', '', '']);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState('');
  const complete =
    reading.every((answer) => answer >= 0) &&
    listening.every((answer) => answer >= 0) &&
    [...writing, ...speaking].every((answer) => answer.trim());

  async function start() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const next = await api('/v1/learning/exams', { method: 'POST', schema: ExamSchema });
      setExam(next);
      setResult(null);
      setStep(0);
      setReading(Array<number>(10).fill(-1));
      setListening(Array<number>(10).fill(-1));
      setWriting(['', '']);
      setSpeaking(['', '', '']);
    } catch {
      setError('Could not start the exam. Please try again.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function submit() {
    if (!exam || pending.current) return;
    if (!complete) {
      setError(
        'Answer all 20 questions and complete both writing tasks and all three speaking parts first.',
      );
      return;
    }
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      setResult(
        await api(`/v1/learning/exams/${exam.id}/answers`, {
          method: 'POST',
          body: { reading, listening, writing, speaking },
          schema: ExamResultSchema,
        }),
      );
    } catch {
      setError(
        'Could not assess the exam. Your answers are still here. Check AI settings and try again.',
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  if (isLoading || !user) return <Skeleton className="h-80" />;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold tracking-wide text-primary uppercase">
          Put your English to the test
        </p>
        <h1 className="text-3xl font-bold">Exams</h1>
        <p className="text-muted">
          IELTS Academic — short practice with a result after completion.
        </p>
      </header>
      <Card className="space-y-4">
        <h2 className="text-xl font-semibold">Four skills. One practice result.</h2>
        <p className="text-sm text-muted">
          Four short listening parts (10 questions), three short reading passages (10 questions),
          two Academic writing tasks, and three speaking parts. Work at your own pace. This is a
          shortened, original practice set, not a full-length or official IELTS test.
        </p>
        <p className="text-sm text-muted">
          Writing and speaking language estimates need your configured AI provider. Pronunciation
          and live fluency are not graded from transcripts. Your overall practice score is out of
          100; it is not an IELTS overall band. Answers and results are held for 24 hours on the
          server. Leaving or refreshing this page clears your current form.
        </p>
        <a
          className="text-sm text-primary underline"
          href="https://ielts.org/take-a-test/test-types/ielts-academic-test"
          target="_blank"
          rel="noreferrer"
        >
          Official IELTS Academic format
        </a>
        {!exam || result ? (
          <Button disabled={busy} onClick={() => void start()}>
            {busy ? 'Starting…' : result ? 'Retake this practice set' : 'Start IELTS practice'}
          </Button>
        ) : null}
      </Card>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {result ? (
        <>
          <Card className="space-y-5">
            <p className="text-sm font-semibold text-muted">Exam completed</p>
            <h2 className="text-3xl font-bold">
              {result.score === null ? 'Demo result' : `Practice score: ${result.score}/100`}
            </h2>
            {result.isMock ? (
              <Alert tone="warning">
                Demo mode: Writing and Speaking were not assessed. No overall score has been
                calculated.
              </Alert>
            ) : null}
            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                ['Listening', `${result.listening}/10 correct`],
                ['Reading', `${result.reading}/10 correct`],
                ['Writing estimate', result.isMock ? 'Not assessed' : `${result.writingBand}/9`],
                [
                  'Speaking language estimate',
                  result.isMock ? 'Not assessed' : `${result.speakingLanguage.band}/9`,
                ],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-surface-muted p-4">
                  <dt className="text-sm text-muted">{label}</dt>
                  <dd className="mt-1 text-xl font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-muted">
              Overall practice score: the average of Listening/10, Reading/10, Writing/9 and
              Speaking language/9, expressed out of 100. Writing Task 2 has twice the weight of Task
              1. AI estimates are approximate and are not official IELTS bands.
            </p>
          </Card>
          {(
            [
              ['Writing Task 1', result.writingTask1],
              ['Writing Task 2', result.writingTask2],
              ['Speaking language', result.speakingLanguage],
            ] as const
          ).map(([title, review]) => (
            <Card key={title} className="space-y-2">
              <h3 className="font-semibold">
                {title}
                {result.isMock ? '' : ` — ${review.band}/9`}
              </h3>
              <p className="text-sm whitespace-pre-wrap">{review.feedback}</p>
            </Card>
          ))}
          {exam ? (
            <Card className="space-y-4">
              <h3 className="font-semibold">Review your answers</h3>
              {(
                [
                  ['Listening', exam.listeningQuestions, result.listeningAnswers, listening],
                  ['Reading', exam.readingQuestions, result.readingAnswers, reading],
                ] as const
              ).map(([title, questions, correct, selected]) => (
                <details key={title}>
                  <summary className="cursor-pointer font-medium">{title} answers</summary>
                  <ol className="mt-3 space-y-3">
                    {questions.map((question, index) => (
                      <li key={index} className="text-sm">
                        <p>
                          {index + 1}. {question.prompt}
                        </p>
                        <p className="text-muted">
                          Your answer: {question.options[selected[index]!]}
                        </p>
                        <p className="font-medium">Correct: {question.options[correct[index]!]}</p>
                      </li>
                    ))}
                  </ol>
                </details>
              ))}
              <details>
                <summary className="cursor-pointer font-medium">Listening transcripts</summary>
                {result.listeningTranscripts.map((text, index) => (
                  <p key={index} className="mt-3 text-sm leading-relaxed">
                    {text}
                  </p>
                ))}
              </details>
            </Card>
          ) : null}
        </>
      ) : exam ? (
        <>
          <nav aria-label="Exam sections" className="flex flex-wrap gap-2">
            {STEPS.map((title, index) => (
              <Button
                key={title}
                variant={step === index ? 'primary' : 'secondary'}
                disabled={busy}
                onClick={() => {
                  setStep(index);
                  setError('');
                }}
              >
                {index + 1}. {title}
              </Button>
            ))}
          </nav>
          <fieldset disabled={busy} aria-label={STEPS[step]} className="space-y-4">
            {step === 0 ? (
              <>
                <Card className="space-y-3">
                  <h2 className="text-xl font-semibold">Listening</h2>
                  <p className="text-sm text-muted">
                    Listen to each part, then choose one answer per question. Transcripts appear
                    after the exam.
                  </p>
                  {[0, 1, 2, 3].map((part) => (
                    <ExamAudio key={`${exam.id}-${part}`} examId={exam.id} part={part} />
                  ))}
                </Card>
                <Questions
                  name="listening"
                  questions={exam.listeningQuestions}
                  answers={listening}
                  onChange={setListening}
                />
              </>
            ) : null}
            {step === 1 ? (
              <>
                <h2 className="text-xl font-semibold">Reading</h2>
                {exam.reading.map((passage, index) => (
                  <Card key={index} className="space-y-3">
                    <h3 className="font-semibold">
                      Passage {index + 1}: {passage.title}
                    </h3>
                    <p className="leading-relaxed">{passage.text}</p>
                  </Card>
                ))}
                <Questions
                  name="reading"
                  questions={exam.readingQuestions}
                  answers={reading}
                  onChange={setReading}
                />
              </>
            ) : null}
            {step === 2 ? (
              <>
                <h2 className="text-xl font-semibold">Academic Writing</h2>
                {exam.writingTasks.map((prompt, index) => (
                  <Card key={index} className="space-y-3">
                    <p className="leading-relaxed">{prompt}</p>
                    <label htmlFor={`writing-task-${index}`} className="block font-medium">
                      Writing Task {index + 1} answer
                    </label>
                    <textarea
                      id={`writing-task-${index}`}
                      lang="en"
                      rows={12}
                      maxLength={index === 0 ? 4000 : 6000}
                      value={writing[index]}
                      onChange={(event) =>
                        setWriting((previous) =>
                          previous.map((answer, position) =>
                            position === index ? event.target.value : answer,
                          ),
                        )
                      }
                      className="w-full rounded-xl border border-border bg-bg p-4"
                    />
                    <p className="text-sm text-muted">
                      {words(writing[index]!)} words · target: {index === 0 ? 150 : 250}+ words
                    </p>
                  </Card>
                ))}
              </>
            ) : null}
            {step === 3 ? (
              <>
                <h2 className="text-xl font-semibold">Speaking</h2>
                <p className="text-sm text-muted">
                  Speak aloud and record segments, or enter a transcript. Review transcription
                  errors before submitting. Only the language in the transcript is assessed.
                </p>
                {exam.speakingTasks.map((prompt, index) => (
                  <Card key={index} className="space-y-3">
                    <p>{prompt}</p>
                    <ExamRecorder
                      onAppend={(text) =>
                        setSpeaking((previous) =>
                          previous.map((answer, position) =>
                            position === index ? `${answer} ${text}`.trim().slice(0, 1000) : answer,
                          ),
                        )
                      }
                    />
                    <label htmlFor={`speaking-part-${index}`} className="block font-medium">
                      Speaking Part {index + 1} transcript
                    </label>
                    <textarea
                      id={`speaking-part-${index}`}
                      lang="en"
                      rows={5}
                      maxLength={1000}
                      value={speaking[index]}
                      onChange={(event) =>
                        setSpeaking((previous) =>
                          previous.map((answer, position) =>
                            position === index ? event.target.value : answer,
                          ),
                        )
                      }
                      className="w-full rounded-xl border border-border bg-bg p-4"
                    />
                  </Card>
                ))}
              </>
            ) : null}
          </fieldset>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              disabled={busy || step === 0}
              onClick={() => setStep(step - 1)}
            >
              Previous section
            </Button>
            {step < 3 ? (
              <Button disabled={busy} onClick={() => setStep(step + 1)}>
                Next section
              </Button>
            ) : (
              <Button disabled={busy} onClick={() => void submit()}>
                {busy ? 'Assessing your exam…' : 'Finish exam & see score'}
              </Button>
            )}
          </div>
          <p role="status" className="text-sm text-muted">
            {busy
              ? 'Checking Writing and Speaking. Your answers remain on this page until the result is ready.'
              : `${listening.filter((answer) => answer >= 0).length + reading.filter((answer) => answer >= 0).length}/20 questions answered`}
          </p>
        </>
      ) : null}
    </div>
  );
}

function Questions({
  name,
  questions,
  answers,
  onChange,
}: {
  name: string;
  questions: Exam['readingQuestions'];
  answers: number[];
  onChange: (answers: number[]) => void;
}) {
  return (
    <div className="space-y-3">
      {questions.map((question, index) => (
        <Card key={index}>
          <fieldset className="space-y-2">
            <legend className="mb-2 font-medium">
              {index + 1}. {question.prompt}
            </legend>
            {question.options.map((option, optionIndex) => (
              <label
                key={optionIndex}
                className="flex cursor-pointer items-start gap-3 rounded-lg bg-surface-muted p-3 text-sm"
              >
                <input
                  type="radio"
                  name={`${name}-${index}`}
                  value={optionIndex}
                  checked={answers[index] === optionIndex}
                  onChange={() =>
                    onChange(
                      answers.map((answer, position) =>
                        position === index ? optionIndex : answer,
                      ),
                    )
                  }
                />
                {option}
              </label>
            ))}
          </fieldset>
        </Card>
      ))}
    </div>
  );
}
