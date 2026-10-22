'use client';

import { useEffect, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { computePeriodResults, lockPeriod, reopenPeriod } from './actions';

interface ResultRow {
  key: string;
  value: string;
}

// One ledger line: label, dotted leader, right-aligned amount. The
// closing figure of a section gets the accountant's double rule.
function Line({ label, value, closing = false }: { label: string; value?: string; closing?: boolean }) {
  if (value === undefined) return null;
  return (
    <div className="flex items-end gap-3 py-1.5 text-sm">
      <span className={closing ? 'font-semibold' : undefined}>{label}</span>
      <span className="leader" aria-hidden />
      <span className={`amount pb-0.5 text-base ${closing ? 'double-rule font-semibold' : 'font-medium'}`}>
        {value}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card px-6 py-5">
      <h2 className="mb-2 border-b border-foreground/30 pb-2 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function PreFilingClient({
  initialResults,
  taxpayerId,
  periodId,
  isFiled,
}: {
  initialResults: ResultRow[];
  taxpayerId: string;
  periodId: string;
  isFiled: boolean;
}) {
  const t = useTranslations('PreDeclaracion');
  const common = useTranslations('Common');
  const [isPending, startTransition] = useTransition();

  // First visit: nothing has been calculated yet, so do it instead of
  // showing an empty screen that looks like there is no data.
  useEffect(() => {
    if (initialResults.length === 0 && !isFiled) {
      startTransition(async () => {
        await computePeriodResults(taxpayerId, periodId);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function recompute() {
    startTransition(async () => {
      await computePeriodResults(taxpayerId, periodId);
    });
  }

  function markFiled() {
    startTransition(() => lockPeriod(taxpayerId, periodId));
  }

  function reopen() {
    startTransition(() => reopenPeriod(taxpayerId, periodId));
  }

  const salesKeys = [
    'SALES_TAXED',
    'SALES_TAXED_VAT',
    'SALES_ZERO_NO_CREDIT',
    'SALES_ZERO_WITH_CREDIT',
    'EXPORT_GOODS',
    'EXPORT_SERVICES',
    'SALES_NON_OBJECT_EXEMPT',
  ];
  const purchaseKeys = [
    'PURCHASES_WITH_CREDIT',
    'PURCHASES_WITH_CREDIT_VAT',
    'PURCHASES_NO_CREDIT',
    'PURCHASES_NO_CREDIT_VAT',
    'PURCHASES_ZERO_VAT',
  ];
  const factorKeys = ['PROPORTIONALITY_FACTOR', 'CREDIT_APPLICABLE', 'VAT_NOT_CREDITED'];

  const byKey = new Map(initialResults.map((r) => [r.key, r.value]));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Badge variant={isFiled ? 'default' : 'secondary'}>
          {isFiled ? t('filedBadge') : t('draftBadge')}
        </Badge>
        <Button onClick={recompute} disabled={isPending || isFiled} size="sm" variant="outline">
          {isPending ? t('recalculating') : t('recalculate')}
        </Button>
      </div>

      <Alert className="border-l-4 border-l-signal">
        <AlertDescription>{common('disclaimer')}</AlertDescription>
      </Alert>

      <Section title={t('salesHeading')}>
        {salesKeys.map((key) => (
          <Line key={key} label={t(`results.${key}`)} value={byKey.get(key)} />
        ))}
      </Section>

      <Section title={t('purchasesHeading')}>
        {purchaseKeys.map((key) => (
          <Line key={key} label={t(`results.${key}`)} value={byKey.get(key)} />
        ))}
      </Section>

      <Section title={t('factorHeading')}>
        {byKey.has('PROPORTIONALITY_FACTOR') ? (
          factorKeys.map((key) => <Line key={key} label={t(`results.${key}`)} value={byKey.get(key)} closing={key === 'CREDIT_APPLICABLE'} />)
        ) : (
          <p className="py-2 text-sm font-medium text-destructive">{t('factorBlocked')}</p>
        )}
      </Section>

      <div className="pt-2">
        {!isFiled ? (
          <Button onClick={markFiled} disabled={isPending}>
            {t('lockPeriod')}
          </Button>
        ) : (
          <Button onClick={reopen} disabled={isPending} variant="outline">
            {t('reopenPeriod')}
          </Button>
        )}
      </div>
    </div>
  );
}
