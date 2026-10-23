import { getTranslations } from 'next-intl/server';
import { getPendingSales } from './actions';
import { SalesTable } from './sales-table';

export default async function SalesPage({
  params,
}: {
  params: Promise<{ taxpayerId: string; periodId: string }>;
}) {
  const { taxpayerId, periodId } = await params;
  const t = await getTranslations('VentasEmitidas');
  const sales = await getPendingSales(taxpayerId, periodId);

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold">{t('title')}</h2>

      <SalesTable
        sales={sales.map((s) => ({
          id: s.id,
          series: s.series,
          issueDate: s.issueDate,
          total: s.total.toString(),
          salesTreatment: s.salesTreatment,
        }))}
        taxpayerId={taxpayerId}
        periodId={periodId}
      />
    </div>
  );
}
