import { getTranslations } from 'next-intl/server';
import { getSupplierRules } from './actions';
import { ProveedoresClient } from './proveedores-client';

export default async function ProveedoresPage({
  params,
}: {
  params: Promise<{ taxpayerId: string }>;
}) {
  const { taxpayerId } = await params;
  const t = await getTranslations('Proveedores');
  const rules = await getSupplierRules(taxpayerId);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h2 className="mb-2 text-xl font-semibold">{t('title')}</h2>
      <p className="mb-6 text-sm text-muted-foreground">{t('intro')}</p>
      <ProveedoresClient taxpayerId={taxpayerId} rules={rules} />
    </div>
  );
}
