'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/lib/auth';
import { flushFocusTime } from '@/lib/focus-time';

export function FocusTimeSync() {
  const { data: user } = useCurrentUser();
  const userId = user?.id;
  const pathname = usePathname();
  const client = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const flush = () => {
      void flushFocusTime(userId).then((saved) => {
        if (saved) void client.invalidateQueries({ queryKey: ['progress', 'weekly', userId] });
      });
    };
    const hidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    flush();
    const interval = setInterval(flush, 15_000);
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', flush);
    window.addEventListener('online', flush);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('online', flush);
      flush();
    };
  }, [userId, pathname, client]);
  return null;
}
