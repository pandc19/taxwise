import { getTranslations } from 'next-intl/server';
import { getTaxRates } from '../actions';
import { RatesClient } from './rates-client';

export default async function RatesPage() {
  const t = await getTranslations('Admin');
  const rates = await getTaxRates();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('tasasTitle')}</h2>
      </div>
      <RatesClient
        initialRates={rates.map((r) => ({
          tax: r.tax,
          rate: r.rate.toString(),
          validFrom: r.validFrom.toISOString(),
          validTo: r.validTo ? r.validTo.toISOString() : null,
          source: r.source,
          verifiedAt: r.verifiedAt.toISOString(),
        }))}
      />
    </div>
  );
}
