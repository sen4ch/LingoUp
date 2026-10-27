import type { WordImage } from '@lingoup/contracts';
import { cn } from '@lingoup/ui';
import { t } from '@/i18n';

export const wordImageUrl = (wordId: string, image: WordImage) =>
  `/api/v1/vocabulary/words/${wordId}/image?v=${encodeURIComponent(image.updatedAt)}`;

/** The learner's picture for a word, with the attribution Creative Commons licenses require. */
export function WordPicture({
  wordId,
  term,
  image,
  className,
}: {
  wordId: string;
  term: string;
  image: WordImage;
  className?: string;
}) {
  return (
    <figure className={cn('flex flex-col items-center gap-1.5', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- served by the API, already resized */}
      <img
        src={wordImageUrl(wordId, image)}
        alt={term}
        className="max-h-56 w-auto max-w-full rounded-lg object-contain"
      />
      <figcaption className="line-clamp-2 max-w-full text-center text-[11px] leading-snug text-muted">
        <Attribution image={image} />
      </figcaption>
    </figure>
  );
}

function Attribution({ image }: { image: WordImage }) {
  if (image.source === 'upload') return <>{t.images.yours}</>;
  const parts = [
    image.title ? `«${image.title}»` : null,
    image.creator ? t.images.by(image.creator) : null,
  ].filter(Boolean);
  return (
    <>
      {parts.join(', ')}
      {image.license ? (
        <>
          {parts.length > 0 ? ' · ' : ''}
          {image.licenseUrl ? (
            <a
              href={image.licenseUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="underline"
            >
              {image.license}
            </a>
          ) : (
            image.license
          )}
        </>
      ) : null}
      {image.landingUrl ? (
        <>
          {' · '}
          <a
            href={image.landingUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="underline"
          >
            {t.images.source}
          </a>
        </>
      ) : null}
    </>
  );
}
