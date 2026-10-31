import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/site-header';
import { PracticeTimerRuntime, PracticeSectionTimer } from '@/components/practice-timer';
import { t } from '@/i18n';
import { Providers } from './providers';
import './globals.css';

/**
 * Where visitors can obtain the corresponding source code. Forks and modified deployments
 * must point this to their own repository (resolved at build time).
 */
const SOURCE_CODE_URL = process.env.SOURCE_CODE_URL || 'https://github.com/sen4ch/LingoUp';

export const metadata: Metadata = {
  title: { default: t.appName, template: `%s · ${t.appName}` },
  description: t.tagline,
  applicationName: t.appName,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0c0c0c',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
        >
          {t.nav.skipToContent}
        </a>
        <Providers>
          <SiteHeader />
          <PracticeTimerRuntime />
          <main
            id="main"
            className="site-main mx-auto w-full max-w-7xl flex-1 px-5 py-8 sm:px-8 sm:py-12"
          >
            <PracticeSectionTimer />
            {children}
          </main>
          <footer className="site-footer mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 border-t border-border px-5 py-7 text-xs text-muted sm:px-8">
            <span className="font-mono tracking-widest uppercase">
              LingoUp <span className="text-primary">↗</span> Keep moving forward.
            </span>
            <span>
              {/* AGPL-3.0 §13: users interacting over a network must be offered the source code. */}
              {t.footer.license}{' '}
              <a href={SOURCE_CODE_URL} className="underline hover:text-text" rel="noopener">
                {t.footer.source}
              </a>
            </span>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
