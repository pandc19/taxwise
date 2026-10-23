'use client';

import { cn } from 'cn';
import { Link, usePathname } from '@/i18n/navigation';
import { LogoutButton } from '@/components/logout-button';

interface AppTopbarProps {
  appName: string;
  logoutLabel: string;
  taxpayersLabel: string;
  adminLabel: string;
  settingsLabel: string;
  isAdmin: boolean;
  userEmail: string;
}

/**
 * The app's one global bar. Three destinations, so it is a bar and not a
 * sidebar: every pixel of width left over goes to the tables.
 */
export function AppTopbar({
  appName,
  logoutLabel,
  taxpayersLabel,
  adminLabel,
  settingsLabel,
  isAdmin,
  userEmail,
}: AppTopbarProps) {
  const pathname = usePathname();

  const inAdmin = pathname.startsWith('/admin');
  const inSettings = pathname.startsWith('/settings');
  const inTaxpayers = !inAdmin && !inSettings;

  const items = [
    { href: '/taxpayers', label: taxpayersLabel, active: inTaxpayers },
    { href: '/settings/ai', label: settingsLabel, active: inSettings },
    ...(isAdmin ? [{ href: '/admin/rates', label: adminLabel, active: inAdmin }] : []),
  ];

  return (
    <header className="sticky top-0 z-30 h-11 bg-sidebar text-sidebar-foreground">
      <div className="flex h-full items-center gap-6 px-4">
        <Link href="/taxpayers" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
          {/* Ledger mark: two rules and a doubled closing rule. */}
          <span aria-hidden className="flex w-4 flex-col gap-[3px]">
            <span className="h-px bg-sidebar-foreground/70" />
            <span className="h-px bg-sidebar-foreground/70" />
            <span className="h-[3px] border-y border-signal" />
          </span>
          {appName}
        </Link>

        <nav className="flex h-full min-w-0 flex-1 items-stretch gap-1 overflow-x-auto">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.active ? 'page' : undefined}
              className={cn(
                'relative flex items-center px-3 text-sm whitespace-nowrap transition-colors',
                item.active
                  ? 'font-medium text-sidebar-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-signal'
                  : 'text-sidebar-muted hover:text-sidebar-foreground'
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          {userEmail && (
            <span className="hidden max-w-48 truncate text-xs text-sidebar-muted sm:block">{userEmail}</span>
          )}
          <LogoutButton label={logoutLabel} />
        </div>
      </div>
    </header>
  );
}
