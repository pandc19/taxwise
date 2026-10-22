import type { ReactNode } from 'react';
import { getLocale } from 'next-intl/server';
import { Schibsted_Grotesk } from 'next/font/google';
import './globals.css';

const schibsted = Schibsted_Grotesk({
  subsets: ['latin'],
  variable: '--font-schibsted',
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
    <html lang={locale} className={schibsted.variable}>
      <body>{children}</body>
    </html>
  );
}
