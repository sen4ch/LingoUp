import { buttonClasses, EmptyState } from '@lingoup/ui';
import Link from 'next/link';
import { t } from '@/i18n';

export default function NotFound() {
  return (
    <EmptyState
      title={t.notFound.title}
      action={
        <Link href="/library" className={buttonClasses('primary')}>
          {t.nav.library}
        </Link>
      }
    >
      {t.notFound.text}
    </EmptyState>
  );
}
