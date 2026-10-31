'use client';

import {
  SaveWordRequestSchema,
  WordSchema,
  WORD_CATEGORIES,
  WORD_CATEGORY_LABELS,
  type Word,
  type WordCategory,
} from '@lingoup/contracts';
import { Alert, Button, TextField, SelectField } from '@lingoup/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { VocabularyIcon as Icon } from './vocabulary-icon';
import { api, ApiRequestError } from '@/lib/api-client';
import { describeError } from '@/lib/errors';
import { DUE_COUNT_QUERY_KEY } from './site-header';

export function VocabularyWordForm({
  word,
  onClose,
  onSaved,
  defaultCategory,
}: {
  word?: Word;
  onClose: () => void;
  onSaved?: () => void;
  defaultCategory?: WordCategory;
}) {
  const client = useQueryClient();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current;
    element?.showModal();
    element?.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = previous;
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  const [term, setTerm] = useState(word?.term ?? '');
  const [translation, setTranslation] = useState(word?.translation ?? '');
  const [definition, setDefinition] = useState(word?.definition ?? '');
  const [contextSentence, setContextSentence] = useState(word?.contextSentence ?? '');
  const [note, setNote] = useState(word?.note ?? '');
  const [category, setCategory] = useState<WordCategory | 'auto'>(
    word?.category ?? defaultCategory ?? 'auto',
  );
  const [validation, setValidation] = useState('');
  const save = useMutation({
    mutationFn: () => {
      const body = {
        translation: translation.trim() || null,
        definition: definition.trim() || null,
        contextSentence: contextSentence.trim() || null,
        note: note.trim() || null,
        category: category === 'auto' ? null : category,
      };
      return api(word ? `/v1/vocabulary/words/${word.id}` : '/v1/vocabulary/words', {
        method: word ? 'PATCH' : 'POST',
        body: word ? body : { ...body, term: term.trim() },
        schema: WordSchema,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['words'] }),
        client.invalidateQueries({ queryKey: ['reviews'] }),
        client.invalidateQueries({ queryKey: DUE_COUNT_QUERY_KEY }),
        client.invalidateQueries({ queryKey: ['progress', 'summary'] }),
        client.invalidateQueries({ queryKey: ['word-categories'] }),
      ]);
      onSaved?.();
      onClose();
    },
  });
  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = SaveWordRequestSchema.safeParse({
      term,
      translation,
      definition,
      contextSentence,
      note,
      category: category === 'auto' ? null : category,
    });
    if (!result.success) {
      setValidation(result.error.issues[0]?.message ?? 'Check the word and try again.');
      return;
    }
    setValidation('');
    save.mutate();
  }
  return (
    <dialog
      ref={dialog}
      className="word-editor-dialog"
      aria-labelledby="word-editor-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!save.isPending) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !save.isPending) onClose();
      }}
    >
      <div className="word-editor-content">
        <div className="word-editor-topline">
          <span className="eyebrow">
            <Icon name="book" width="14" height="14" /> GROW YOUR COLLECTION
          </span>
          <button
            type="button"
            aria-label="Close word editor"
            disabled={save.isPending}
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4" aria-label={word ? 'Edit word' : 'Add word'}>
          <h2 id="word-editor-title" className="text-3xl font-medium tracking-tight">
            {word ? 'Make this word yours.' : 'A new word. A new possibility.'}
          </h2>
          <p className="text-sm text-muted">
            Add a translation in your preferred language. New words are ready for review
            immediately.
          </p>
          <fieldset disabled={save.isPending} className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="English word or phrase"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              required
              maxLength={80}
              disabled={Boolean(word)}
              placeholder="e.g. opportunity"
              hint="Up to 6 words."
            />
            <TextField
              label="Translation"
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
              maxLength={200}
              placeholder="Your translation or meaning"
            />
            <div className="sm:col-span-2">
              <SelectField
                label="Category"
                value={category}
                onChange={(event) => setCategory(event.target.value as WordCategory | 'auto')}
                options={[
                  { value: 'auto', label: 'Choose automatically' },
                  ...WORD_CATEGORIES.map((value) => ({
                    value,
                    label: WORD_CATEGORY_LABELS[value],
                  })),
                ]}
                hint="Common words are organised automatically. You can always choose a different category."
              />
            </div>
            <TextField
              label="Definition (optional)"
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              maxLength={500}
            />
            <TextField
              label="Example sentence (optional)"
              value={contextSentence}
              onChange={(e) => setContextSentence(e.target.value)}
              maxLength={600}
            />
            <div className="sm:col-span-2">
              <TextField
                label="Note (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
              />
            </div>
          </fieldset>
          {validation ? <Alert tone="danger">{validation}</Alert> : null}
          {save.isError ? (
            <Alert tone="danger">
              {save.error instanceof ApiRequestError && save.error.code === 'WORD_ALREADY_SAVED'
                ? 'This word is already in your vocabulary. Search for it to edit its translation.'
                : describeError(save.error)}
            </Alert>
          ) : null}
          <div className="word-editor-footer flex gap-2">
            <Button type="submit" loading={save.isPending}>
              {word ? 'Save changes' : 'Add word'}
            </Button>
            <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
