import type { ReactNode } from 'react';
import { getLocale } from 'next-intl/server';
import { IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-plex',
  weight: ['400', '500', '600'],
  display: 'swap',
});

// The single <html>/<body> shell for the whole app, including src/app/api/*
// which must never be locale-prefixed. Per-locale text and NextIntlClientProvider
// live in src/app/[locale]/layout.tsx.
export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const locale = await getLocale();

  return (
    <html lang={locale} className={plex.variable}>
      <body>{children}</body>
    </html>
  );
}
