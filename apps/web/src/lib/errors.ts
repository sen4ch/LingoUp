import { t } from '@/i18n';
import { ApiRequestError } from './api-client';

/** Human-readable message for an API or network failure. Never exposes server internals. */
export function describeError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.code === 'NETWORK_ERROR') return t.common.networkError;
    if (error.code === 'RATE_LIMITED') return t.common.rateLimited;
  }
  return t.common.error;
}
