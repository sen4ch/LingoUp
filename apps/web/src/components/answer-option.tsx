import { cn } from '@lingoup/ui';
import { t } from '@/i18n';

export type AnswerOptionState = 'idle' | 'correct' | 'wrong' | 'inactive';

// Complete color sets per state rather than overrides on buttonClasses('secondary'):
// `cn` does not merge conflicting utilities, so an appended state color would lose to
// the secondary button's bg-surface.
const STATE_CLASSES: Record<AnswerOptionState, string> = {
  idle: 'border border-border bg-surface font-medium text-text hover:bg-surface-muted',
  correct: 'cursor-default border-2 border-success bg-success-bg font-semibold text-success',
  wrong: 'cursor-default border-2 border-danger bg-danger-bg font-semibold text-danger',
  inactive: 'cursor-default border border-border bg-surface font-medium text-muted',
};

/** One answer of a multiple-choice exercise; after answering it shows whether it was right. */
export function AnswerOption({
  label,
  state,
  onSelect,
}: {
  label: string;
  state: AnswerOptionState;
  onSelect: () => void;
}) {
  const answered = state !== 'idle';
  return (
    <button
      type="button"
      aria-disabled={answered || undefined}
      onClick={answered ? undefined : onSelect}
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm transition-colors',
        STATE_CLASSES[state],
      )}
    >
      {state === 'correct' || state === 'wrong' ? (
        <span aria-hidden className="mr-1.5">
          {state === 'correct' ? '✓' : '✗'}
        </span>
      ) : null}
      {label}
      {state === 'correct' || state === 'wrong' ? (
        <span className="sr-only">
          {' — '}
          {state === 'correct' ? t.grammar.correct : t.grammar.incorrect}
        </span>
      ) : null}
    </button>
  );
}

/** State of `option` once `picked` has been checked against `correct` (null: not answered). */
export function answerOptionState(
  option: string,
  picked: string | null,
  correct: string | null,
): AnswerOptionState {
  if (picked === null || correct === null) return 'idle';
  if (option === correct) return 'correct';
  return option === picked ? 'wrong' : 'inactive';
}
