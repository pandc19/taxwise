import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { AppTopbar } from '@/components/app-topbar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('Common');
  const session = await auth();
  const isAdmin = session?.user?.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-background">
      <AppTopbar
        appName={t('appName')}
        logoutLabel={t('logout')}
        taxpayersLabel={t('navTaxpayers')}
        adminLabel={t('navAdmin')}
        settingsLabel={t('navSettings')}
        isAdmin={isAdmin}
        userEmail={session?.user?.email ?? ''}
      />
      <main>{children}</main>
    </div>
  );
}
