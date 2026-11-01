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
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { VocabularyIcon as Icon } from '@/components/vocabulary-icon';
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
    queryKey: ['progress', 'summary', user?.id],
    enabled: !isLoading && Boolean(user),
    queryFn: () => api('/v1/progress/summary', { schema: ProgressSummarySchema }),
    staleTime: 0,
  });

  const [view, setView] = useState<'overview' | 'plan' | 'weekly' | 'settings'>('overview');
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const header = document.querySelector('.site-header');
    const fit = () =>
      root.current?.style.setProperty(
        '--profile-header-height',
        `${header?.getBoundingClientRect().height ?? 72}px`,
      );
    const readHash = () => {
      const target = window.location.hash.slice(1);
      setView(
        target === 'plan' || target === 'weekly' || target === 'settings' ? target : 'overview',
      );
    };
    readHash();
    fit();
    const observer = new ResizeObserver(fit);
    if (header) observer.observe(header);
    window.addEventListener('hashchange', readHash);
    return () => {
      observer.disconnect();
      window.removeEventListener('hashchange', readHash);
    };
  }, [user?.id]);
  function chooseView(value: typeof view) {
    setView(value);
    window.history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search + (value === 'overview' ? '' : `#${value}`),
    );
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  if (isLoading || !user) return <Skeleton className="h-96" />;
  return (
    <div ref={root} className="profile-workspace">
      <header className="profile-heading">
        <div>
          <p className="eyebrow">
            <Icon name="spark" width="13" height="13" /> YOUR ENGLISH, TAKING SHAPE.
          </p>
          <h1>
            {t.profile.title}
            <span className="text-primary" aria-hidden="true">
              .
            </span>
          </h1>
          <p>A little practice. Every step adds up.</p>
        </div>
        <div className="profile-identity">
          <span className="profile-avatar" aria-hidden="true">
            {user.displayName
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => Array.from(part)[0] ?? '')
              .join('')
              .toUpperCase() || 'L'}
          </span>
          <div>
            <h2>{user.displayName}</h2>
            <p>{user.email}</p>
            <span>
              {user.settings.targetLevel} · {user.settings.dailyGoalMinutes} min daily goal
            </span>
          </div>
        </div>
      </header>
      <div className="profile-navigation" role="group" aria-label="Profile sections">
        {(['overview', 'plan', 'weekly', 'settings'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={view === value}
            aria-controls={
              value === 'overview'
                ? 'profile-overview profile-skills'
                : value === 'plan'
                  ? 'profile-plan'
                  : value === 'weekly'
                    ? 'profile-weekly'
                    : 'profile-settings'
            }
            onClick={() => chooseView(value)}
          >
            <Icon
              name={
                value === 'overview'
                  ? 'grid'
                  : value === 'plan'
                    ? 'book'
                    : value === 'weekly'
                      ? 'clock'
                      : 'settings'
              }
              width="15"
              height="15"
            />
            {value === 'overview'
              ? 'Overview'
              : value === 'plan'
                ? 'Learning plan'
                : value === 'weekly'
                  ? 'Weekly summary'
                  : 'Settings'}
          </button>
        ))}
      </div>
      <div id="profile-overview" hidden={view !== 'overview'}>
        <section aria-labelledby="stats" className="profile-progress">
          <div className="profile-section-heading">
            <div>
              <p className="eyebrow">THE LITTLE THINGS, ADDING UP</p>
              <h2 id="stats">{t.profile.stats}</h2>
            </div>
            <Link href="/mistakes">
              Review your mistake journal
              <Icon name="arrow" width="13" height="13" />
            </Link>
          </div>
          {summary.isPending ? (
            <Skeleton className="h-40" />
          ) : summary.isError ? (
            <Alert tone="danger">
              {describeError(summary.error)}
              <Button variant="secondary" onClick={() => void summary.refetch()}>
                Retry progress
              </Button>
            </Alert>
          ) : (
            <dl className="profile-stats">
              {[
                [t.profile.totalWords, summary.data.vocabulary.total],
                [t.profile.dueNow, summary.data.vocabulary.dueNow],
                [t.profile.totalReviews, summary.data.vocabulary.totalReviews],
                [t.profile.textsCompleted, summary.data.textsCompleted],
                [t.profile.exercisesDone, summary.data.exercisesDone],
                [t.profile.streak, summary.data.streakDays],
              ].map(([label, value], index) => (
                <Card key={String(label)} className="profile-stat">
                  <dt>
                    <Icon
                      name={
                        index === 0
                          ? 'cards'
                          : index === 1
                            ? 'clock'
                            : index === 2
                              ? 'check'
                              : index === 3
                                ? 'book'
                                : index === 4
                                  ? 'edit'
                                  : 'spark'
                      }
                      width="12"
                      height="12"
                    />
                    {label}
                  </dt>
                  <dd>
                    {value}
                    {index === 5 ? <span>days</span> : null}
                  </dd>
                </Card>
              ))}
            </dl>
          )}
        </section>
        <div className="profile-overview-grid">
          <div className="profile-next">
            <ContinueLearning />
          </div>
          <Card className="profile-activity">
            <div>
              <h3>{t.profile.activity}</h3>
              <span>CONSISTENCY, ONE DAY AT A TIME</span>
            </div>
            {summary.data ? (
              summary.data.activity.some(
                (day) =>
                  day.wordsSaved + day.reviewsDone + day.textsCompleted + day.exercisesDone > 0,
              ) ? (
                <ActivityChart activity={summary.data.activity} />
              ) : (
                <div className="profile-activity-empty">
                  <Icon name="spark" width="25" height="25" />
                  <p>Your next step starts here.</p>
                  <span>Your activity will appear as you practise.</span>
                </div>
              )
            ) : summary.isPending ? (
              <Skeleton className="h-28" />
            ) : (
              <p>Activity could not be loaded.</p>
            )}
            <p className="profile-activity-note">
              Recent results may take a little time to appear.
            </p>
          </Card>
        </div>
      </div>
      <LearningDashboard
        settings={user.settings}
        userId={user.id}
        key={user.id}
        section={view === 'overview' ? 'skills' : view === 'plan' ? 'plan' : 'hidden'}
      />
      <div id="profile-weekly" hidden={view !== 'weekly'}>
        <WeeklyReport userId={user.id} />
      </div>
      <div id="profile-settings" hidden={view !== 'settings'}>
        <div className="profile-preferences-intro">
          <p className="eyebrow">MAKE LINGOUP YOURS</p>
          <h2>
            Your preferences<span className="text-primary">.</span>
          </h2>
          <p>Your translation language, learning level, and AI sharing preferences.</p>
        </div>
        <SettingsForm settings={user.settings} key={user.id} onPlan={() => chooseView('plan')} />
        <DataSection />
      </div>
    </div>
  );
}
function SettingsForm({ settings, onPlan }: { settings: UserSettings; onPlan: () => void }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<UserSettings>(settings);
  const save = useMutation({
    mutationFn: (patch: UpdateSettingsRequest) =>
      api('/v1/me/settings', { method: 'PATCH', body: patch, schema: UserSettingsSchema }),
    onSuccess: (updated) => {
      setDraft(updated);
      return queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
    },
  });
  function edit(patch: Partial<UserSettings>) {
    setDraft((current) => ({ ...current, ...patch }));
    save.reset();
  }
  const onSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { dailyGoalMinutes: _dailyGoal, ...patch } = draft;
    save.mutate(patch);
  };

  return (
    <section
      id="settings"
      aria-labelledby="settings-title"
      className="profile-settings-form flex flex-col gap-4"
    >
      <h2 id="settings-title" className="text-xl font-semibold">
        {t.profile.settings}
      </h2>
      <Card className="profile-settings-card">
        <form onSubmit={onSubmit} className="profile-settings-fields">
          <SelectField
            label={t.profile.nativeLanguage}
            value={draft.nativeLanguage}
            disabled={save.isPending}
            options={LANGUAGES}
            onChange={(e) =>
              edit({
                nativeLanguage: e.target.value as UserSettings['nativeLanguage'],
              })
            }
          />
          <SelectField
            label={t.profile.targetLevel}
            value={draft.targetLevel}
            disabled={save.isPending}
            options={CEFR_LEVELS.map((level) => ({
              value: level,
              label: `${level} — ${t.levels.names[level]}`,
            }))}
            onChange={(e) => edit({ targetLevel: e.target.value as UserSettings['targetLevel'] })}
          />
          <div className="profile-sharing">
            <label className="flex items-start gap-3 text-sm font-medium">
              <input
                type="checkbox"
                className="mt-0.5 size-4"
                checked={draft.aiDataSharing}
                disabled={save.isPending}
                onChange={(e) => edit({ aiDataSharing: e.target.checked })}
                aria-describedby="ai-sharing-hint"
              />
              {t.profile.aiSharing}
            </label>
            <p id="ai-sharing-hint" className="pl-7 text-xs text-muted">
              {t.profile.aiSharingHint}
            </p>
          </div>
          <div className="profile-settings-actions">
            <Button type="submit" loading={save.isPending}>
              <Icon name="check" width="13" height="13" />
              {t.common.save}
            </Button>
            {save.isSuccess ? (
              <span role="status" className="text-sm text-success">
                {t.profile.settingsSaved}
              </span>
            ) : null}
            {save.isError ? <Alert tone="danger">{describeError(save.error)}</Alert> : null}
          </div>
          <p className="profile-plan-settings-link">
            Your daily study time is managed in your learning plan.
            <button type="button" onClick={onPlan}>
              Edit daily study time
              <Icon name="arrow" width="12" height="12" />
            </button>
          </p>
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
    <section aria-labelledby="data-title" className="profile-data flex flex-col gap-4">
      <h2 id="data-title" className="text-xl font-semibold">
        {t.profile.data}
      </h2>
      <Card className="profile-data-card">
        <div className="profile-export">
          <span>
            <Icon name="download" width="21" height="21" />
          </span>
          <div>
            <h3>Your data, in your hands.</h3>
            <p>Keep a copy of your vocabulary, progress, and settings.</p>
            {/* A plain link: the browser downloads the JSON with the session cookie. */}
            <a
              href="/api/v1/me/export"
              download="lingoup-export.json"
              className="profile-export-link"
            >
              {t.profile.export}
              <Icon name="arrow" width="12" height="12" />
            </a>
          </div>
        </div>
        <div className="profile-account-controls">
          {confirming ? (
            <form
              className="profile-delete-form"
              onSubmit={(event) => {
                event.preventDefault();
                remove.mutate();
              }}
            >
              <Alert tone="danger">{t.profile.deleteWarning}</Alert>
              <TextField
                label={t.profile.deletePassword}
                type="password"
                autoFocus
                disabled={remove.isPending}
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
                <Button
                  variant="secondary"
                  disabled={remove.isPending}
                  onClick={() => {
                    setConfirming(false);
                    setPassword('');
                    remove.reset();
                  }}
                >
                  {t.common.cancel}
                </Button>
              </div>
            </form>
          ) : (
            <>
              <div>
                <h3>Account controls</h3>
                <p>Permanently remove your account and its data.</p>
              </div>
              <Button variant="danger-outline" onClick={() => setConfirming(true)}>
                <Icon name="trash" width="13" height="13" />
                {t.profile.deleteAccount}
              </Button>
            </>
          )}
        </div>
      </Card>
    </section>
  );
}
