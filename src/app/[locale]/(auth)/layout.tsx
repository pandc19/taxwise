import { getTranslations } from 'next-intl/server';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('Common');

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex">
        {/* Ledger rules: the page this product replaces. */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, currentColor 0 1px, transparent 1px 2.25rem), linear-gradient(to right, transparent calc(100% - 7rem), currentColor calc(100% - 7rem) calc(100% - 7rem + 1px), transparent calc(100% - 7rem + 1px))',
          }}
        />
        <p className="relative text-2xl font-semibold tracking-tight">{t('appName')}</p>
        <p className="relative max-w-sm text-4xl leading-tight font-semibold tracking-tight">
          {t('authTagline')}
        </p>
      </aside>
      <div className="flex items-center justify-center bg-background">{children}</div>
    </div>
  );
}
