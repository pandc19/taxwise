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
    <div className="mx-auto max-w-4xl px-6 py-8">

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
