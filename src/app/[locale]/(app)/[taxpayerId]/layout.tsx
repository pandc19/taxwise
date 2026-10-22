import { getTranslations } from 'next-intl/server';
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
  const taxpayer = await getTaxpayer(taxpayerId);

  return (
    <div>
      <div className="border-b bg-card">
        <div className="mx-auto max-w-5xl px-6 pt-5">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 className="min-w-0 truncate text-xl font-semibold">{taxpayer.businessName}</h2>
            <span className="text-sm text-muted-foreground tabular-nums">
              {t('ruc')} {taxpayer.ruc}
            </span>
          </div>
          <div className="mt-3">
            <TaxpayerTabs
              tabs={[
                { href: `/${taxpayerId}/periods`, label: t('navPeriods') },
                { href: `/${taxpayerId}/suppliers`, label: t('navSuppliers') },
                { href: `/${taxpayerId}/edit`, label: t('navEditShort') },
              ]}
            />
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
