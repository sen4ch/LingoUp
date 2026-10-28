'use client';

import { Alert, Button, Card, TextField, buttonClasses } from '@lingoup/ui';
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { t } from '@/i18n';
import { subtitlesVtt, youtubeEmbed } from '@/lib/listening-video';

const CATALOG = [
  {
    title: 'The Flatmates · Episode 1',
    author: 'BBC Learning English',
    description: 'Учебный сериал о жизни соседей. Британский английский, короткие эпизоды.',
    url: 'https://www.youtube.com/watch?v=vAi1JlMIQVM',
  },
  {
    title: 'Sintel',
    author: 'Blender Foundation',
    description: 'Короткометражный фэнтези-фильм на английском. История путешествия и дружбы.',
    url: 'https://www.youtube.com/watch?v=eRsGyueVLvQ',
  },
];

export function ListeningWatch() {
  const [draft, setDraft] = useState('');
  const [embed, setEmbed] = useState<ReturnType<typeof youtubeEmbed>>(null);
  const [video, setVideo] = useState<{ url: string; name: string } | null>(null);
  const [captions, setCaptions] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const objects = useRef<string[]>([]);
  useEffect(() => () => objects.current.forEach((url) => URL.revokeObjectURL(url)), []);
  const clearFiles = () => {
    objects.current.forEach((url) => URL.revokeObjectURL(url));
    objects.current = [];
    setVideo(null);
    setCaptions(null);
  };
  const open = (url: string) => {
    const selected = youtubeEmbed(url);
    if (!selected) {
      setError(t.listening.videoLinkError);
      return;
    }
    clearFiles();
    setEmbed(selected);
    setError(null);
  };
  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    open(draft);
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted">{t.listening.watchIntro}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {CATALOG.map((item) => (
          <Card key={item.url} className="flex flex-col items-start gap-2">
            <p className="text-xs font-semibold text-primary">{item.author}</p>
            <h2 className="text-lg font-semibold">{item.title}</h2>
            <p className="text-sm text-muted">{item.description}</p>
            <Button
              variant="secondary"
              onClick={() => {
                setDraft(item.url);
                open(item.url);
              }}
            >
              {t.listening.watch}
            </Button>
          </Card>
        ))}
      </div>
      <Card className="flex flex-col gap-4">
        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <TextField
              label={t.listening.videoLink}
              placeholder="https://www.youtube.com/watch?v=…"
              value={draft}
              maxLength={500}
              onChange={(event) => setDraft(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={!draft.trim()}>
            {t.listening.openVideo}
          </Button>
        </form>
        <div className="flex flex-wrap items-center gap-3">
          <label className={buttonClasses('secondary', 'sm')}>
            {t.listening.localVideo}
            <input
              type="file"
              accept="video/*,.mkv"
              className="sr-only"
              aria-label={t.listening.localVideo}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                clearFiles();
                const url = URL.createObjectURL(file);
                objects.current.push(url);
                setVideo({ url, name: file.name });
                setEmbed(null);
                setError(null);
                event.target.value = '';
              }}
            />
          </label>
          {video ? (
            <label className={buttonClasses('secondary', 'sm')}>
              {t.listening.subtitles}
              <input
                type="file"
                accept=".vtt,.srt"
                className="sr-only"
                aria-label={t.listening.subtitles}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  event.target.value = '';
                  if (file.size > 2 * 1024 * 1024) {
                    setError(t.listening.subtitleError);
                    return;
                  }
                  void file
                    .text()
                    .then((text) => {
                      const url = URL.createObjectURL(
                        new Blob([subtitlesVtt(text)], { type: 'text/vtt' }),
                      );
                      objects.current.push(url);
                      setCaptions(url);
                      setError(null);
                    })
                    .catch(() => setError(t.listening.subtitleError));
                }}
              />
            </label>
          ) : null}
        </div>
        <p className="text-xs text-muted">{t.listening.localPrivacy}</p>
        {error ? <Alert tone="warning">{error}</Alert> : null}
      </Card>
      {embed ? (
        <Card className="flex flex-col gap-3">
          <iframe
            key={embed.src}
            src={embed.src}
            title={t.listening.videoPlayer}
            className="aspect-video w-full rounded-lg border-0"
            allow="encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
          <p className="text-sm text-muted">
            {t.listening.embedHint}{' '}
            <a
              href={embed.original}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {t.listening.openYoutube}
            </a>
          </p>
        </Card>
      ) : null}
      {video ? (
        <Card className="flex flex-col gap-3">
          <h2 className="font-semibold">{video.name}</h2>
          <video
            key={`${video.url}:${captions ?? ''}`}
            controls
            playsInline
            preload="metadata"
            src={video.url}
            className="aspect-video w-full rounded-lg bg-black"
            onError={() => setError(t.listening.videoFormatError)}
          >
            {captions ? (
              <track kind="subtitles" src={captions} srcLang="en" label="English" default />
            ) : (
              <track kind="captions" />
            )}
          </video>
          {captions ? <p className="text-sm text-muted">{t.listening.subtitlesReady}</p> : null}
        </Card>
      ) : null}
    </div>
  );
}
