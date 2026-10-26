'use client';

import { CurrentUserSchema } from '@lingoup/contracts';
import { Alert, Button, Card, TextField } from '@lingoup/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type SyntheticEvent } from 'react';
import { t } from '@/i18n';
import { api, ApiRequestError } from '@/lib/api-client';
import { ME_QUERY_KEY, safeNextPath } from '@/lib/auth';
import { describeError } from '@/lib/errors';

type Mode = 'login' | 'register';

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.code === 'INVALID_CREDENTIALS') return t.auth.invalidCredentials;
    if (error.code === 'EMAIL_ALREADY_REGISTERED') return t.auth.emailTaken;
    if (error.code === 'VALIDATION_FAILED') return t.auth.validation;
  }
  return describeError(error);
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ email: '', password: '', displayName: '' });
  const next = safeNextPath(searchParams.get('next'));

  const submit = useMutation({
    mutationFn: () =>
      api(`/v1/auth/${mode}`, {
        method: 'POST',
        body: mode === 'register' ? form : { email: form.email, password: form.password },
        schema: CurrentUserSchema,
      }),
    onSuccess: (user) => {
      queryClient.clear();
      queryClient.setQueryData(ME_QUERY_KEY, user);
      router.replace(next);
    },
  });

  const onSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit.mutate();
  };
  const update = (field: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const isRegister = mode === 'register';
  return (
    <Card className="mx-auto w-full max-w-md">
      <h1 className="mb-6 text-2xl font-bold">
        {isRegister ? t.auth.registerTitle : t.auth.loginTitle}
      </h1>
      {searchParams.get('next') ? (
        <Alert tone="info" className="mb-4">
          {t.auth.required}
        </Alert>
      ) : null}
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate={false}>
        {isRegister ? (
          <TextField
            label={t.auth.displayName}
            name="displayName"
            autoComplete="nickname"
            required
            maxLength={60}
            value={form.displayName}
            onChange={update('displayName')}
          />
        ) : null}
        <TextField
          label={t.auth.email}
          name="email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={update('email')}
        />
        <TextField
          label={t.auth.password}
          name="password"
          type="password"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          required
          minLength={isRegister ? 10 : 1}
          maxLength={128}
          hint={isRegister ? t.auth.passwordHint : undefined}
          value={form.password}
          onChange={update('password')}
        />
        {submit.isError ? <Alert tone="danger">{errorMessage(submit.error)}</Alert> : null}
        <Button type="submit" size="lg" loading={submit.isPending}>
          {isRegister ? t.auth.submitRegister : t.auth.submitLogin}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        {isRegister ? t.auth.haveAccount : t.auth.noAccount}{' '}
        <Link
          href={`${isRegister ? '/login' : '/register'}${next !== '/library' ? `?next=${encodeURIComponent(next)}` : ''}`}
          className="font-medium text-primary underline"
        >
          {isRegister ? t.nav.login : t.nav.register}
        </Link>
      </p>
    </Card>
  );
}
