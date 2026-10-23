import { getTranslations } from 'next-intl/server';
import { ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { getTaxpayer } from './actions';
import { TaxpayerTabs } from './taxpayer-tabs';

export default async function TaxpayerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ taxpayerId: string }>;
}) {
  const { taxpayerId } = await params;
  const t = await getTranslations('Taxpayers');
  const common = await getTranslations('Common');
  const taxpayer = await getTaxpayer(taxpayerId);

  return (
    <div>
      <div className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 px-4">
          <div className="flex min-w-0 items-center gap-1.5 py-2.5 text-sm">
            <Link href="/taxpayers" className="text-muted-foreground hover:text-foreground">
              {common('navTaxpayers')}
            </Link>
            <ChevronRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
            <h2 className="min-w-0 truncate font-semibold">{taxpayer.businessName}</h2>
            <span className="ml-2 shrink-0 text-muted-foreground tabular-nums">
              {t('ruc')} {taxpayer.ruc}
            </span>
          </div>
          <TaxpayerTabs
            tabs={[
              { href: `/${taxpayerId}/periods`, label: t('navPeriods') },
              { href: `/${taxpayerId}/suppliers`, label: t('navSuppliers') },
              { href: `/${taxpayerId}/edit`, label: t('navEditShort') },
            ]}
          />
        </div>
      </div>
      {children}
    </div>
  );
}
