'use client';

import { useRef, useState, type ReactNode } from 'react';
import { ExamSchema, ExamResultSchema, type Exam, type ExamResult } from '@lingoup/contracts';
import { Alert, Button, Card, Skeleton } from '@lingoup/ui';
import { api } from '@/lib/api-client';
import { useRequireUser } from '@/lib/auth';
import { ExamRecorder } from '@/components/exam-recorder';
import { ExamAudio } from '@/components/exam-audio';
import { VocabularyIcon as Icon } from '@/components/vocabulary-icon';

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
  const listeningAnswered = listening.filter((answer) => answer >= 0).length;
  const readingAnswered = reading.filter((answer) => answer >= 0).length;
  const answered = listeningAnswered + readingAnswered;
  const stepProgress = [
    `${listeningAnswered}/10`,
    `${readingAnswered}/10`,
    `${writing.filter((answer) => answer.trim()).length}/2`,
    `${speaking.filter((answer) => answer.trim()).length}/3`,
  ];
  const alert = error ? <Alert tone="danger">{error}</Alert> : null;
  if (result)
    return (
      <div className="grammar-workspace">
        <header className="grammar-lesson-header">
          <p className="eyebrow">
            <Icon name="check" width="14" height="14" /> EXAM COMPLETED
          </p>
          <h1>{result.score === null ? 'Demo result' : `Practice score: ${result.score}/100`}</h1>
          <p className="text-muted">
            Overall practice score: the average of Listening/10, Reading/10, Writing/9 and Speaking
            language/9, expressed out of 100. Writing Task 2 has twice the weight of Task 1. AI
            estimates are approximate and are not official IELTS bands.
          </p>
        </header>
        {result.isMock ? (
          <Alert tone="warning">
            Demo mode: Writing and Speaking were not assessed. No overall score has been calculated.
          </Alert>
        ) : null}
        {alert}
        <dl className="exams-scores">
          {[
            ['Listening', `${result.listening}/10 correct`],
            ['Reading', `${result.reading}/10 correct`],
            ['Writing estimate', result.isMock ? 'Not assessed' : `${result.writingBand}/9`],
            [
              'Speaking language estimate',
              result.isMock ? 'Not assessed' : `${result.speakingLanguage.band}/9`,
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="grammar-layout">
          <section className="exams-section" aria-labelledby="exams-feedback-title">
            <SectionHeading id="exams-feedback-title" title="Your feedback">
              What went well, and what to work on next.
            </SectionHeading>
            {(
              [
                ['Writing Task 1', result.writingTask1],
                ['Writing Task 2', result.writingTask2],
                ['Speaking language', result.speakingLanguage],
              ] as const
            ).map(([title, review]) => (
              <Card key={title} className="exams-card">
                <h3>
                  {title}
                  {result.isMock ? '' : ` — ${review.band}/9`}
                </h3>
                <p className="whitespace-pre-wrap">{review.feedback}</p>
              </Card>
            ))}
            {exam ? (
              <Card className="exams-card exams-review">
                <h3>Review your answers</h3>
                {(
                  [
                    ['Listening', exam.listeningQuestions, result.listeningAnswers, listening],
                    ['Reading', exam.readingQuestions, result.readingAnswers, reading],
                  ] as const
                ).map(([title, questions, correct, selected]) => (
                  <details key={title}>
                    <summary>{title} answers</summary>
                    <ol>
                      {questions.map((question, index) => (
                        <li key={index}>
                          <p>
                            {index + 1}. {question.prompt}
                          </p>
                          <p className="text-muted">
                            Your answer: {question.options[selected[index]!]}
                          </p>
                          <p className="exams-correct">
                            Correct: {question.options[correct[index]!]}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </details>
                ))}
                <details>
                  <summary>Listening transcripts</summary>
                  {result.listeningTranscripts.map((text, index) => (
                    <p key={index} className="exams-transcript">
                      {text}
                    </p>
                  ))}
                </details>
              </Card>
            ) : null}
          </section>
          <aside className="grammar-sidebar" aria-label="Your next exam">
            <div className="grammar-next-card">
              <p className="eyebrow">
                <Icon name="spark" width="13" height="13" /> YOUR NEXT SMALL STEP
              </p>
              <span className="grammar-next-symbol" aria-hidden="true">
                4<span>→</span>1
              </span>
              <h2>Go again.</h2>
              <p>Use your feedback and see what changes on a second attempt.</p>
              <Button className="w-full" disabled={busy} onClick={() => void start()}>
                {busy ? 'Starting…' : 'Retake this practice set'}
              </Button>
            </div>
          </aside>
        </div>
      </div>
    );
  if (exam)
    return (
      <div className="grammar-workspace">
        <header className="grammar-lesson-header">
          <p className="eyebrow">
            <span className="status-dot" /> PRACTICE IN PROGRESS
          </p>
          <h1>{exam.title}</h1>
          <p className="text-muted">
            Work at your own pace. Move between sections freely until you finish.
          </p>
        </header>
        <div className="grammar-layout">
          <div className="exams-section">
            <nav aria-label="Exam sections" className="grammar-tabs exams-tabs">
              {STEPS.map((title, index) => (
                <button
                  key={title}
                  type="button"
                  aria-pressed={step === index}
                  disabled={busy}
                  onClick={() => {
                    setStep(index);
                    setError('');
                  }}
                >
                  {index + 1}. {title}
                  <span>{stepProgress[index]}</span>
                </button>
              ))}
            </nav>
            <fieldset disabled={busy} aria-label={STEPS[step]} className="exams-section">
              {step === 0 ? (
                <>
                  <SectionHeading title="Listening">
                    Listen to each part, then choose one answer per question. Transcripts appear
                    after the exam.
                  </SectionHeading>
                  <div className="exams-audio-grid">
                    {[0, 1, 2, 3].map((part) => (
                      <ExamAudio key={`${exam.id}-${part}`} examId={exam.id} part={part} />
                    ))}
                  </div>
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
                  <SectionHeading title="Reading">
                    Read the three passages, then choose one answer per question.
                  </SectionHeading>
                  {exam.reading.map((passage, index) => (
                    <Card key={index} className="exams-card">
                      <p className="exams-card-label">PASSAGE {index + 1}</p>
                      <h3>{passage.title}</h3>
                      <p className="exams-reading-text">{passage.text}</p>
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
                  <SectionHeading title="Academic Writing">
                    Two tasks, written in your own words.
                  </SectionHeading>
                  {exam.writingTasks.map((prompt, index) => (
                    <Card key={index} className="exams-card">
                      <p className="exams-reading-text">{prompt}</p>
                      <label htmlFor={`writing-task-${index}`}>
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
                      />
                      <p className="exams-hint">
                        {words(writing[index]!)} words · target: {index === 0 ? 150 : 250}+ words
                      </p>
                    </Card>
                  ))}
                </>
              ) : null}
              {step === 3 ? (
                <>
                  <SectionHeading title="Speaking">
                    Speak aloud and record segments, or enter a transcript. Review transcription
                    errors before submitting. Only the language in the transcript is assessed.
                  </SectionHeading>
                  {exam.speakingTasks.map((prompt, index) => (
                    <Card key={index} className="exams-card">
                      <p className="exams-reading-text">{prompt}</p>
                      <ExamRecorder
                        onAppend={(text) =>
                          setSpeaking((previous) =>
                            previous.map((answer, position) =>
                              position === index
                                ? `${answer} ${text}`.trim().slice(0, 1000)
                                : answer,
                            ),
                          )
                        }
                      />
                      <label htmlFor={`speaking-part-${index}`}>
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
                      />
                    </Card>
                  ))}
                </>
              ) : null}
            </fieldset>
            {alert}
            <div className="exams-actions">
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
                  <Icon name="arrow" width="16" height="16" />
                </Button>
              ) : (
                <Button disabled={busy} onClick={() => void submit()}>
                  {busy ? 'Assessing your exam…' : 'Finish exam & see score'}
                </Button>
              )}
            </div>
          </div>
          <aside className="grammar-sidebar grammar-lesson-sidebar" aria-label="Your exam progress">
            <div className="grammar-focus exams-progress">
              <p className="eyebrow">
                <Icon name="clock" width="14" height="14" /> YOUR PROGRESS
              </p>
              <strong>
                {answered}
                <span>/20</span>
              </strong>
              <progress value={answered} max={20} aria-label="Questions answered" />
              <p role="status">
                {busy
                  ? 'Checking Writing and Speaking. Your answers remain on this page until the result is ready.'
                  : `${answered}/20 questions answered`}
              </p>
            </div>
            <div className="grammar-progress-note">
              <Icon name="book" />
              <h3>Stay on this page.</h3>
              <p>Leaving or refreshing this page clears your current form.</p>
            </div>
          </aside>
        </div>
      </div>
    );
  return (
    <div className="grammar-workspace">
      <header className="grammar-hero">
        <div>
          <p className="eyebrow">
            <Icon name="spark" width="14" height="14" /> PUT YOUR ENGLISH TO THE TEST
          </p>
          <h1>
            Exams, <span>one step at a time.</span>
          </h1>
          <p>IELTS Academic — short practice with a result after completion.</p>
          <div className="grammar-hero-note">
            <Icon name="check" width="15" height="15" /> Four skills <span>·</span> Your own pace{' '}
            <span>·</span> One practice result
          </div>
        </div>
        <div className="grammar-sentence-art exams-art" aria-hidden="true">
          <span className="grammar-art-label">WHAT YOU WILL PRACTISE</span>
          {(
            [
              ['Listen', 10, 'questions.'],
              ['Read', 10, 'questions.'],
              ['Write', 2, 'tasks.'],
              ['Speak', 3, 'parts.'],
            ] as const
          ).map(([skill, count, unit]) => (
            <div key={skill}>
              <span>{skill}</span>
              <strong>{count}</strong>
              <span>{unit}</span>
            </div>
          ))}
          <span className="grammar-art-caption">
            <span className="status-dot" /> FOUR SKILLS. ONE PRACTICE RESULT.
          </span>
        </div>
      </header>
      <div className="grammar-overview" aria-label="Practice set overview">
        <div>
          <Icon name="grid" />
          <strong>4</strong>
          <span>Skills in one set</span>
        </div>
        <div>
          <Icon name="check" />
          <strong>20</strong>
          <span>Multiple-choice questions</span>
        </div>
        <div>
          <Icon name="edit" />
          <strong>5</strong>
          <span>Writing and speaking tasks</span>
        </div>
      </div>
      {alert}
      <div className="grammar-layout">
        <section className="exams-section" aria-labelledby="exams-inside-title">
          <SectionHeading id="exams-inside-title" title="What’s inside">
            Four skills. One practice result.
          </SectionHeading>
          <ul className="grammar-topic-grid">
            {(
              [
                ['play', 'Listening', 'Four short parts with 10 questions.'],
                ['book', 'Reading', 'Three short passages with 10 questions.'],
                ['edit', 'Writing', 'Two Academic tasks, estimated by your AI provider.'],
                ['mic', 'Speaking', 'Three parts. Record your answer or enter a transcript.'],
              ] as const
            ).map(([icon, title, text]) => (
              <li key={title} className="exams-skill">
                <span className="grammar-topic-symbol" aria-hidden="true">
                  <Icon name={icon} width="18" height="18" />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ul>
          <Card className="exams-card exams-notes">
            <h3>Before you start</h3>
            <ul>
              <li>
                This is a shortened, original practice set, not a full-length or official IELTS
                test.
              </li>
              <li>
                Writing and speaking language estimates need your configured AI provider.
                Pronunciation and live fluency are not graded from transcripts.
              </li>
              <li>Your overall practice score is out of 100; it is not an IELTS overall band.</li>
              <li>
                Answers and results are held for 24 hours on the server. Leaving or refreshing this
                page clears your current form.
              </li>
            </ul>
          </Card>
        </section>
        <aside className="grammar-sidebar" aria-label="Start your practice">
          <div className="grammar-next-card">
            <p className="eyebrow">
              <Icon name="spark" width="13" height="13" /> YOUR NEXT SMALL STEP
            </p>
            <span className="grammar-next-symbol" aria-hidden="true">
              4<span>→</span>1
            </span>
            <h2>Ready when you are.</h2>
            <p>Work at your own pace and see your result at the end.</p>
            <Button className="w-full" disabled={busy} onClick={() => void start()}>
              {busy ? 'Starting…' : 'Start IELTS practice'}
            </Button>
          </div>
          <div className="grammar-progress-note">
            <Icon name="book" />
            <h3>Know the real format.</h3>
            <p>See how this practice set compares with the full test.</p>
            <a
              href="https://ielts.org/take-a-test/test-types/ielts-academic-test"
              target="_blank"
              rel="noreferrer"
            >
              Official IELTS Academic format <Icon name="arrow" width="14" height="14" />
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SectionHeading({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="grammar-section-heading exams-heading">
      <div>
        <h2 id={id}>
          {title}
          <span className="text-primary">.</span>
        </h2>
        <p>{children}</p>
      </div>
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
    <div className="exams-section">
      {questions.map((question, index) => (
        <Card key={index} className="exams-card">
          <fieldset className="exams-question">
            <legend>
              {index + 1}. {question.prompt}
            </legend>
            {question.options.map((option, optionIndex) => (
              <label key={optionIndex}>
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
