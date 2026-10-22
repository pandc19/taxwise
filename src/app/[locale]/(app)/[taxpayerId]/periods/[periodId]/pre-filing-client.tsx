'use client';

import { useEffect, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { computePeriodResults, lockPeriod, reopenPeriod } from './actions';

interface ResultRow {
  key: string;
  value: string;
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Badge variant={isFiled ? 'default' : 'secondary'}>
          {isFiled ? t('filedBadge') : t('draftBadge')}
        </Badge>
        <Button onClick={recompute} disabled={isPending || isFiled} size="sm" variant="outline">
          {isPending ? t('recalculating') : t('recalculate')}
        </Button>
      </div>

      <Alert>
        <AlertDescription>{common('disclaimer')}</AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>{t('salesHeading')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {salesKeys.map((key) =>
            byKey.has(key) ? (
              <div key={key} className="flex justify-between text-sm">
                <span>{t(`results.${key}`)}</span>
                <strong>{byKey.get(key)}</strong>
              </div>
            ) : null
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('purchasesHeading')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {purchaseKeys.map((key) =>
            byKey.has(key) ? (
              <div key={key} className="flex justify-between text-sm">
                <span>{t(`results.${key}`)}</span>
                <strong>{byKey.get(key)}</strong>
              </div>
            ) : null
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('factorHeading')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {byKey.has('PROPORTIONALITY_FACTOR') ? (
            factorKeys.map((key) =>
              byKey.has(key) ? (
                <div key={key} className="flex justify-between text-sm">
                  <span>{t(`results.${key}`)}</span>
                  <strong>{byKey.get(key)}</strong>
                </div>
              ) : null
            )
          ) : (
            <p className="text-sm text-destructive">{t('factorBlocked')}</p>
          )}
        </CardContent>
      </Card>

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
  );
}
