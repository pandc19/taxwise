import { getTranslations } from 'next-intl/server';
import { getTaxpayerPeriods } from './actions';
import { PeriodsClient } from './periods-client';

export default async function PeriodsPage({
  params,
}: {
  params: Promise<{ taxpayerId: string }>;
}) {
  const { taxpayerId } = await params;
  const t = await getTranslations('Periods');

  const periods = await getTaxpayerPeriods(taxpayerId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <PeriodsClient
        taxpayerId={taxpayerId}
        initialPeriods={periods.map((p) => ({
          id: p.id,
          periodStart: p.periodStart.toISOString(),
          status: p.status,
        }))}
      />
    </div>
  );
}
