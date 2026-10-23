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
    <div className="mx-auto max-w-7xl px-4 py-4">
      <h2 className="mb-1 text-xl font-semibold">{t('title')}</h2>
      <p className="mb-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">{t('intro')}</p>
      <SuppliersClient taxpayerId={taxpayerId} rules={rules} />
    </div>
  );
}
