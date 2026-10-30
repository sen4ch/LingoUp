'use client';

import Link from 'next/link';

import {
  CEFR_LEVELS,
  ProgressSummarySchema,
  UserSettingsSchema,
  type UpdateSettingsRequest,
  type UserSettings,
} from '@lingoup/contracts';
import { Alert, Button, Card, SelectField, Skeleton, TextField } from '@lingoup/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, type SyntheticEvent } from 'react';
import { ActivityChart } from '@/components/activity-chart';
import { LearningDashboard } from '@/components/learning-dashboard';
import { WeeklyReport } from '@/components/weekly-report';
import { ContinueLearning } from '@/components/continue-learning';
import { t } from '@/i18n';
import { api } from '@/lib/api-client';
import { ME_QUERY_KEY, useRequireUser } from '@/lib/auth';
import { describeError } from '@/lib/errors';

const LANGUAGES = [
  { value: 'ru', label: 'Russian' },
  { value: 'uk', label: 'Ukrainian' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'de', label: 'German' },
  { value: 'fr', label: 'French' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'tr', label: 'Turkish' },
  { value: 'zh', label: 'Chinese' },
];

export default function ProfilePage() {
  const { user, isLoading } = useRequireUser();
  const summary = useQuery({
    queryKey: ['progress', 'summary'],
    enabled: !isLoading,
    queryFn: () => api('/v1/progress/summary', { schema: ProgressSummarySchema }),
    staleTime: 0,
  });

  if (isLoading || !user) return <Skeleton className="h-96" />;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{t.profile.title}</h1>
        <Link
          href="/mistakes"
          className="mt-2 inline-block text-sm font-semibold text-primary underline"
        >
          Review your mistake journal
        </Link>
        <p className="text-muted">
          {user.displayName} · {user.email}
        </p>
      </header>

      <ContinueLearning />
      <LearningDashboard settings={user.settings} userId={user.id} />
      <WeeklyReport userId={user.id} />

      <section aria-labelledby="stats" className="flex flex-col gap-4">
        <h2 id="stats" className="text-xl font-semibold">
          {t.profile.stats}
        </h2>
        {summary.isPending ? (
          <Skeleton className="h-40" />
        ) : summary.isError ? (
          <Alert tone="danger">{describeError(summary.error)}</Alert>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                [t.profile.totalWords, summary.data.vocabulary.total],
                [t.profile.dueNow, summary.data.vocabulary.dueNow],
                [t.profile.totalReviews, summary.data.vocabulary.totalReviews],
                [t.profile.textsCompleted, summary.data.textsCompleted],
                [t.profile.exercisesDone, summary.data.exercisesDone],
                [t.profile.streak, summary.data.streakDays],
              ].map(([label, value]) => (
                <Card key={String(label)} className="flex flex-col-reverse gap-1 p-4">
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="text-2xl font-bold">{value}</dd>
                </Card>
              ))}
            </dl>
            <Card className="flex flex-col gap-3">
              <h3 className="font-semibold">{t.profile.activity}</h3>
              <ActivityChart activity={summary.data.activity} />
              <p className="text-xs text-muted">
                {summary.data.activityUpdatedAt ? t.profile.activityLag : t.profile.activityNotYet}
              </p>
            </Card>
          </>
        )}
      </section>

      <SettingsForm settings={user.settings} />
      <DataSection />
    </div>
  );
}

function SettingsForm({ settings }: { settings: UserSettings }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<UserSettings>(settings);
  const save = useMutation({
    mutationFn: (patch: UpdateSettingsRequest) =>
      api('/v1/me/settings', { method: 'PATCH', body: patch, schema: UserSettingsSchema }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY }),
  });
  const onSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { dailyGoalMinutes: _dailyGoal, ...patch } = draft;
    save.mutate(patch);
  };

  return (
    <section id="settings" aria-labelledby="settings-title" className="flex flex-col gap-4">
      <h2 id="settings-title" className="text-xl font-semibold">
        {t.profile.settings}
      </h2>
      <Card>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label={t.profile.nativeLanguage}
            value={draft.nativeLanguage}
            options={LANGUAGES}
            onChange={(e) =>
              setDraft({
                ...draft,
                nativeLanguage: e.target.value as UserSettings['nativeLanguage'],
              })
            }
          />
          <SelectField
            label={t.profile.targetLevel}
            value={draft.targetLevel}
            options={CEFR_LEVELS.map((level) => ({
              value: level,
              label: `${level} — ${t.levels.names[level]}`,
            }))}
            onChange={(e) =>
              setDraft({ ...draft, targetLevel: e.target.value as UserSettings['targetLevel'] })
            }
          />
          <div className="flex flex-col gap-1 sm:col-span-3">
            <label className="flex items-start gap-3 text-sm font-medium">
              <input
                type="checkbox"
                className="mt-0.5 size-4"
                checked={draft.aiDataSharing}
                onChange={(e) => setDraft({ ...draft, aiDataSharing: e.target.checked })}
                aria-describedby="ai-sharing-hint"
              />
              {t.profile.aiSharing}
            </label>
            <p id="ai-sharing-hint" className="pl-7 text-xs text-muted">
              {t.profile.aiSharingHint}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
            <Button type="submit" loading={save.isPending}>
              {t.common.save}
            </Button>
            {save.isSuccess ? (
              <span role="status" className="text-sm text-success">
                {t.profile.settingsSaved}
              </span>
            ) : null}
            {save.isError ? <Alert tone="danger">{describeError(save.error)}</Alert> : null}
          </div>
        </form>
      </Card>
    </section>
  );
}

function DataSection() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const remove = useMutation({
    mutationFn: () => api('/v1/me', { method: 'DELETE', body: { password } }),
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(ME_QUERY_KEY, null);
      router.replace('/library');
    },
  });

  return (
    <section aria-labelledby="data-title" className="flex flex-col gap-4">
      <h2 id="data-title" className="text-xl font-semibold">
        {t.profile.data}
      </h2>
      <Card className="flex flex-col gap-4">
        {/* A plain link: the browser downloads the JSON with the session cookie. */}
        <a
          href="/api/v1/me/export"
          download="lingoup-export.json"
          className="self-start text-sm font-medium text-primary underline"
        >
          {t.profile.export}
        </a>
        <div className="border-t border-border pt-4">
          {confirming ? (
            <form
              className="flex max-w-sm flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                remove.mutate();
              }}
            >
              <Alert tone="danger">{t.profile.deleteWarning}</Alert>
              <TextField
                label={t.profile.deletePassword}
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={remove.isError ? describeError(remove.error) : undefined}
              />
              <div className="flex gap-2">
                <Button type="submit" variant="danger" loading={remove.isPending}>
                  {t.profile.deleteAccount}
                </Button>
                <Button variant="secondary" onClick={() => setConfirming(false)}>
                  {t.common.cancel}
                </Button>
              </div>
            </form>
          ) : (
            <Button variant="danger-outline" onClick={() => setConfirming(true)}>
              {t.profile.deleteAccount}
            </Button>
          )}
        </div>
      </Card>
    </section>
  );
}
