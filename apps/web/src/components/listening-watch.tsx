'use client';

import { Alert, Button, Card, TextField, buttonClasses } from '@lingoup/ui';
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { t } from '@/i18n';
import { VocabularyIcon as Icon } from '@/components/vocabulary-icon';
import { subtitlesVtt, youtubeEmbed } from '@/lib/listening-video';

const CATALOG = [
  {
    title: 'The Flatmates · Episode 1',
    author: 'BBC Learning English',
    description: 'An educational series about flatmates. British English in short episodes.',
    url: 'https://www.youtube.com/watch?v=vAi1JlMIQVM',
  },
  {
    title: 'Sintel',
    author: 'Blender Foundation',
    description: 'A short fantasy film in English. A story of adventure and friendship.',
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
    <div className="listening-watch">
      <p className="listening-watch-intro">{t.listening.watchIntro}</p>
      <div className="listening-watch-grid">
        <div className="listening-player-zone">
          {embed ? (
            <Card className="listening-video-panel">
              <div className="listening-video-panel-label">
                <Icon name="film" width="13" height="13" />
                YOUR FRONT-ROW SEAT TO ENGLISH
              </div>
              <iframe
                key={embed.src}
                src={embed.src}
                title={t.listening.videoPlayer}
                className="aspect-video w-full border-0"
                allow="encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
              <p>
                {t.listening.embedHint}{' '}
                <a href={embed.original} target="_blank" rel="noopener noreferrer">
                  {t.listening.openYoutube}
                  <Icon name="arrow" width="12" height="12" />
                </a>
              </p>
            </Card>
          ) : video ? (
            <Card className="listening-video-panel">
              <div className="listening-local-video-heading">
                <Icon name="film" width="14" height="14" />
                <h2>{video.name}</h2>
                <span>ON YOUR DEVICE</span>
              </div>
              <video
                key={`${video.url}:${captions ?? ''}`}
                controls
                playsInline
                preload="metadata"
                src={video.url}
                className="aspect-video w-full bg-black"
                onError={() => setError(t.listening.videoFormatError)}
              >
                {captions ? (
                  <track kind="subtitles" src={captions} srcLang="en" label="English" default />
                ) : (
                  <track kind="captions" />
                )}
              </video>
              {captions ? (
                <p className="listening-caption-ready">
                  <Icon name="check" width="13" height="13" />
                  {t.listening.subtitlesReady}
                </p>
              ) : (
                <p>Add English subtitles above, or use captions included in your video.</p>
              )}
            </Card>
          ) : (
            <Card className="listening-video-empty">
              <div className="listening-video-art" aria-hidden="true">
                <span>ENGLISH, IN SCENE.</span>
                <div>
                  <Icon name="play" width="35" height="35" />
                </div>
                <i />
                <i />
              </div>
              <p className="eyebrow">MAKE ENGLISH PART OF YOUR WORLD</p>
              <h2>
                Let the story
                <br />
                sink in<span className="text-primary">.</span>
              </h2>
              <p>
                Choose a starting point, open a YouTube link, or bring your own video. A good story
                makes listening feel natural.
              </p>
            </Card>
          )}
          <div className="listening-watch-tips">
            <span>
              <b>01</b>Listen for the main idea.
            </span>
            <span>
              <b>02</b>Replay a useful phrase.
            </span>
            <span>
              <b>03</b>Try it without subtitles.
            </span>
          </div>
        </div>
        <Card className="listening-video-source">
          <header>
            <p className="eyebrow">
              <Icon name="plus" width="12" height="12" /> YOUR VIDEO, YOUR CHOICE
            </p>
            <h2>Bring a story.</h2>
          </header>
          <form onSubmit={submit}>
            <TextField
              label={t.listening.videoLink}
              placeholder="https://www.youtube.com/watch?v=…"
              value={draft}
              maxLength={500}
              onChange={(event) => setDraft(event.target.value)}
            />
            <Button type="submit" disabled={!draft.trim()}>
              {t.listening.openVideo}
              <Icon name="arrow" width="13" height="13" />
            </Button>
          </form>
          <div className="listening-file-tools">
            <label className={buttonClasses('secondary', 'sm', 'listening-file-button')}>
              <Icon name="upload" width="13" height="13" />
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
              <label className={buttonClasses('secondary', 'sm', 'listening-file-button')}>
                <Icon name="cards" width="13" height="13" />
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
          <p className="listening-file-privacy">{t.listening.localPrivacy}</p>
          {error ? <Alert tone="warning">{error}</Alert> : null}
        </Card>
        <section className="listening-video-catalog" aria-label="Starting points">
          <div className="listening-catalog-heading">
            <p className="eyebrow">A GOOD PLACE TO START</p>
            <span>{CATALOG.length} starting points</span>
          </div>
          {CATALOG.map((item, index) => (
            <Card key={item.url} className="listening-catalog-card">
              <div className="listening-catalog-art" data-film={index === 1} aria-hidden="true">
                <Icon name={index === 0 ? 'film' : 'play'} width="24" height="24" />
                <span>{index === 0 ? 'EP 01' : 'SHORT FILM'}</span>
              </div>
              <div>
                <p>{item.author}</p>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDraft(item.url);
                    open(item.url);
                  }}
                >
                  {t.listening.watch}
                  <Icon name="arrow" width="12" height="12" />
                </Button>
              </div>
            </Card>
          ))}
        </section>
      </div>
    </div>
  );
}
