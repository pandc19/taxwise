import { getTranslations } from 'next-intl/server';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { redirect } from '@/i18n/navigation';
import { requireAdmin } from '@/lib/session';
import { AdminNav } from './admin-nav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin();
  } catch {
    redirect({ href: '/taxpayers', locale: 'es' });
  }
  const t = await getTranslations('Admin');

  return (
    <div className="mx-auto max-w-7xl px-4 py-4">
      <h1 className="mb-3 text-xl font-semibold">{t('title')}</h1>
      <Alert className="mb-6 border-l-4 border-l-signal">
        <AlertDescription>{t('disclaimer')}</AlertDescription>
      </Alert>

      <AdminNav
        items={[
          { href: '/admin/rates', label: t('navTasas') },
        ]}
      />

      {children}
    </div>
  );
}
