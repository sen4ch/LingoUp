'use client';

import { Alert, Button } from '@lingoup/ui';
import { t } from '@/i18n';

/** Route-level error boundary, e.g. when the API is unreachable during server rendering. */
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Alert
      tone="danger"
      title={t.common.error}
      action={
        <Button variant="secondary" onClick={reset}>
          {t.common.retry}
        </Button>
      }
    >
      {t.common.networkError}
    </Alert>
  );
}
