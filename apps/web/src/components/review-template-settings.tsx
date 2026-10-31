'use client';

import {
  DEFAULT_REVIEW_TEMPLATE,
  UserSettingsSchema,
  type ReviewTemplate,
} from '@lingoup/contracts';
import { Alert, Button, Card, SelectField } from '@lingoup/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { api } from '@/lib/api-client';
import { ME_QUERY_KEY } from '@/lib/auth';
import { describeError } from '@/lib/errors';
import { VocabularyIcon as Icon } from './vocabulary-icon';

export function ReviewTemplateSettings({ saved }: { saved: ReviewTemplate | undefined }) {
  const client = useQueryClient();
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const openFromLink = () => {
      if (window.location.hash === '#card-display' && details.current) details.current.open = true;
    };
    openFromLink();
    window.addEventListener('hashchange', openFromLink);
    return () => window.removeEventListener('hashchange', openFromLink);
  }, []);
  const [template, setTemplate] = useState(saved ?? DEFAULT_REVIEW_TEMPLATE);
  const [revealed, setRevealed] = useState(false);
  const save = useMutation({
    mutationFn: () =>
      api('/v1/me/settings', {
        method: 'PATCH',
        body: { reviewTemplate: template },
        schema: UserSettingsSchema,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ME_QUERY_KEY }),
  });
  function update(patch: Partial<ReviewTemplate>) {
    setTemplate((value) => ({ ...value, ...patch }));
    setRevealed(false);
    save.reset();
  }
  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate();
  }
  return (
    <details ref={details} id="card-display" className="review-template-panel scroll-mt-36">
      <summary>
        <span className="template-settings-icon">
          <Icon name="settings" />
        </span>
        <span className="template-summary-copy">
          <strong>Card display settings</strong>
          <span>Your cards, your way. Choose what comes first.</span>
        </span>
        <span className="template-current-mode">
          {saved?.front === 'translation' ? 'Translation → English' : 'English → Translation'}
        </span>
        <Icon name="chevron" className="template-chevron" width="16" height="16" />
      </summary>
      <form onSubmit={submit} className="template-settings-form grid gap-6 md:grid-cols-2">
        <fieldset disabled={save.isPending} className="space-y-4">
          <SelectField
            label="Show first"
            value={template.front}
            onChange={(e) => update({ front: e.target.value as ReviewTemplate['front'] })}
            options={[
              { value: 'term', label: 'English word → translation' },
              { value: 'translation', label: 'Translation → English word' },
            ]}
          />
          <p className="text-sm text-muted">
            Recall the English word from your translation. Words without a translation use English
            first. Settings are saved to your account.
          </p>
          {(
            [
              ['showDefinition', 'Show definition after revealing'],
              ['showContext', 'Show example sentence'],
              ['showImage', 'Show image after revealing'],
            ] as const
          ).map(([field, label]) => (
            <label key={field} className="template-option flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={template[field]}
                onChange={(e) => update({ [field]: e.target.checked })}
                className="size-4 accent-primary"
              />
              {label}
            </label>
          ))}
          <p className="text-xs text-muted">
            When the translation is first, the English example and pronunciation appear only after
            you reveal the answer.
          </p>
          <Button type="submit" loading={save.isPending}>
            Save card settings
          </Button>
          {save.isError ? <Alert tone="danger">{describeError(save.error)}</Alert> : null}
          {save.isSuccess ? (
            <p role="status" className="text-sm text-success">
              Card settings saved.
            </p>
          ) : null}
        </fieldset>
        <Card className="template-preview flex flex-col items-center justify-center gap-4 text-center">
          <p className="eyebrow">
            <span className="status-dot" /> LIVE PREVIEW
          </p>
          <p className="text-3xl font-semibold">
            {template.front === 'translation' ? 'Your translation' : 'opportunity'}
          </p>
          {template.showContext && (template.front === 'term' || revealed) ? (
            <p className="font-reading text-muted italic">
              “This is a great opportunity to learn.”
            </p>
          ) : null}
          {revealed ? (
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-xl text-primary">
                {template.front === 'translation' ? 'opportunity' : 'Your translation'}
              </p>
              {template.showDefinition ? (
                <p className="text-sm text-muted">A chance to do something.</p>
              ) : null}
              {template.showImage ? (
                <p className="text-xs text-muted">A saved image appears here when available.</p>
              ) : null}
            </div>
          ) : null}
          <Button variant="secondary" size="sm" onClick={() => setRevealed((value) => !value)}>
            {revealed ? 'Hide preview answer' : 'Reveal preview answer'}
          </Button>
        </Card>
      </form>
    </details>
  );
}
