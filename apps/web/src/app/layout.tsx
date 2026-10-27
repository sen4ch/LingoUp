import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/site-header';
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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f6f2' },
    { media: '(prefers-color-scheme: dark)', color: '#141413' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="flex min-h-dvh flex-col antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
        >
          {t.nav.skipToContent}
        </a>
        <Providers>
          <SiteHeader />
          <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-10">
            {children}
          </main>
          <footer className="mx-auto w-full max-w-5xl border-t border-border px-4 py-6 text-xs text-muted">
            {/* AGPL-3.0 §13: users interacting over a network must be offered the source code. */}
            {t.footer.license}{' '}
            <a href={SOURCE_CODE_URL} className="underline hover:text-text" rel="noopener">
              {t.footer.source}
            </a>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
