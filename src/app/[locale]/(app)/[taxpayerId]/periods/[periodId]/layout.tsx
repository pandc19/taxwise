import { getTranslations } from 'next-intl/server';
import { ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { withUser } from '@/lib/db';
import { getCurrentUserId } from '@/lib/session';
import { PeriodStepNav } from './period-step-nav';

export default async function PeriodLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ taxpayerId: string; periodId: string }>;
}) {
  const { taxpayerId, periodId } = await params;
  const nav = await getTranslations('PeriodNav');
  const periods = await getTranslations('Periods');
  const taxpayers = await getTranslations('Taxpayers');

  const userId = await getCurrentUserId();
  const period = await withUser(userId, (tx) =>
    tx.taxPeriod.findUniqueOrThrow({ where: { id: periodId } })
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex items-baseline gap-1.5">
          <Link
            href={`/${taxpayerId}/periods`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {taxpayers('navPeriods')}
          </Link>
          <ChevronRight aria-hidden className="size-3.5 translate-y-0.5 text-muted-foreground" />
          <h1 className="text-xl font-semibold">
            {periods(`months.${period.periodStart.getUTCMonth() + 1}`)} {period.periodStart.getUTCFullYear()}
          </h1>
        </div>
        <PeriodStepNav
          taxpayerId={taxpayerId}
          periodId={periodId}
          labels={{
            overview: nav('overview'),
            ingestion: nav('ingestion'),
            sales: nav('sales'),
            reconciliation: nav('reconciliation'),
            'pre-filing': nav('pre-filing'),
          }}
        />
      </div>
      {children}
    </div>
  );
}
