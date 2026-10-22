import { getTranslations } from 'next-intl/server';
import { withUser } from '@/lib/db';
import { getCurrentUserId } from '@/lib/session';
import { PeriodOverview } from './period-overview';

export default async function PeriodOverviewPage({
  params,
}: {
  params: Promise<{ taxpayerId: string; periodId: string }>;
}) {
  const { taxpayerId, periodId } = await params;
  const t = await getTranslations('PreDeclaracion');
  const nav = await getTranslations('PeriodNav');

  const userId = await getCurrentUserId();
  const invoiceCount = await withUser(userId, async (tx) => {
    const [received, issued] = await Promise.all([
      tx.invoiceReceived.count({ where: { taxPeriodId: periodId } }),
      tx.invoiceIssued.count({ where: { taxPeriodId: periodId } }),
    ]);
    return received + issued;
  });

  return (
    <PeriodOverview
      taxpayerId={taxpayerId}
      periodId={periodId}
      hasData={invoiceCount > 0}
      labels={{
        heading: t('overviewHeading'),
        ingestionTitle: nav('ingestion'),
        ingestionDescription: t('overviewIngestionDescription'),
        salesTitle: nav('sales'),
        salesDescription: t('overviewSalesDescription'),
        reconciliationTitle: nav('reconciliation'),
        reconciliationDescription: t('overviewReconciliationDescription'),
        preFilingTitle: nav('pre-filing'),
        preFilingDescription: t('overviewPreFilingDescription'),
        startHere: t('overviewStartHere'),
      }}
    />
  );
}
