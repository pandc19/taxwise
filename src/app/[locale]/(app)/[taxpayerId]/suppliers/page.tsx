import { getTranslations } from 'next-intl/server';
import { getSupplierRules } from './actions';
import { SuppliersClient } from './suppliers-client';

export default async function SuppliersPage({
  params,
}: {
  params: Promise<{ taxpayerId: string }>;
}) {
  const { taxpayerId } = await params;
  const t = await getTranslations('Proveedores');
  const rules = await getSupplierRules(taxpayerId);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h2 className="mb-2 text-3xl font-semibold">{t('title')}</h2>
      <p className="mb-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">{t('intro')}</p>
      <SuppliersClient taxpayerId={taxpayerId} rules={rules} />
    </div>
  );
}
