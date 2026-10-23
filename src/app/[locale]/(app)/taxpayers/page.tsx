import { getTranslations } from 'next-intl/server';
import { ChevronRight, SquarePen } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getMyTaxpayers } from './actions';

export default async function TaxpayersPage() {
  const t = await getTranslations('Taxpayers');
  const taxpayers = await getMyTaxpayers();

  return (
    <div className="mx-auto max-w-7xl px-4 py-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        {taxpayers.length > 0 && (
          <Button asChild>
            <Link href="/taxpayers/new">{t('newButton')}</Link>
          </Button>
        )}
      </div>

      {taxpayers.length === 0 ? (
        <div className="rounded-md border border-dashed border-foreground/25 px-6 py-12 text-center">
          <p className="mx-auto mb-5 max-w-sm text-muted-foreground">{t('emptyState')}</p>
          <Button asChild>
            <Link href="/taxpayers/new">{t('emptyStateCta')}</Link>
          </Button>
        </div>
      ) : (
        <ul className="settle divide-y divide-border overflow-hidden rounded-md border bg-card">
          {taxpayers.map((taxpayer) => (
            <li key={taxpayer.id} className="group relative flex items-center gap-4 px-4 py-2.5 transition-colors hover:bg-accent/60">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/${taxpayer.id}/periods`}
                  className="block truncate font-semibold after:absolute after:inset-0"
                >
                  {taxpayer.businessName}
                </Link>
                <p className="text-sm text-muted-foreground tabular-nums">
                  {t('ruc')} {taxpayer.ruc}
                </p>
              </div>
              <div className="hidden shrink-0 gap-1.5 sm:flex">
                <Badge variant="secondary">{t(`regimeOptions.${taxpayer.regime}`)}</Badge>
                <Badge variant="outline">{t(`periodicityOptions.${taxpayer.ivaPeriodicity}`)}</Badge>
              </div>
              <Button
                asChild
                variant="ghost"
                size="icon-sm"
                className="relative z-10"
                title={t('navEdit')}
              >
                <Link href={`/${taxpayer.id}/edit`} aria-label={t('navEdit')}>
                  <SquarePen className="size-4" />
                </Link>
              </Button>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
