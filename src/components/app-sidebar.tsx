'use client';

import { useState } from 'react';
import { cn } from 'cn';
import { Building2, Menu, ShieldCheck, Sparkles, X } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { LogoutButton } from '@/components/logout-button';

interface AppSidebarProps {
  appName: string;
  logoutLabel: string;
  taxpayersLabel: string;
  adminLabel: string;
  settingsLabel: string;
  isAdmin: boolean;
  userEmail: string;
}

export function AppSidebar({
  appName,
  logoutLabel,
  taxpayersLabel,
  adminLabel,
  settingsLabel,
  isAdmin,
  userEmail,
}: AppSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isSettingsSection = pathname.startsWith('/settings');
  const isTaxpayersSection = !pathname.startsWith('/admin') && !isSettingsSection;
  const isAdminSection = pathname.startsWith('/admin');

  const navLinkClass = (active: boolean) =>
    cn(
      'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
      active
        ? 'bg-white/10 text-sidebar-foreground before:absolute before:inset-y-1.5 before:-left-2 before:w-0.5 before:rounded-full before:bg-signal'
        : 'text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground'
    );

  const content = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between px-5 pt-6 pb-8">
        <Link
          href="/taxpayers"
          className="flex items-center gap-2.5 text-xl font-semibold tracking-tight"
          onClick={() => setMobileOpen(false)}
        >
          {/* Ledger mark: three ruled lines, the last one doubled. */}
          <span aria-hidden className="flex w-5 flex-col gap-[3px]">
            <span className="h-px bg-sidebar-foreground/70" />
            <span className="h-px bg-sidebar-foreground/70" />
            <span className="h-[3px] border-y border-signal" />
          </span>
          {appName}
        </Link>
        <button
          type="button"
          className="md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Cerrar menú"
        >
          <X className="size-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-4">
        <Link
          href="/taxpayers"
          className={navLinkClass(isTaxpayersSection)}
          onClick={() => setMobileOpen(false)}
        >
          <Building2 className="size-4" />
          {taxpayersLabel}
        </Link>
        <Link
          href="/settings/ai"
          className={navLinkClass(isSettingsSection)}
          onClick={() => setMobileOpen(false)}
        >
          <Sparkles className="size-4" />
          {settingsLabel}
        </Link>
        {isAdmin && (
          <Link
            href="/admin/rates"
            className={navLinkClass(isAdminSection)}
            onClick={() => setMobileOpen(false)}
          >
            <ShieldCheck className="size-4" />
            {adminLabel}
          </Link>
        )}
      </nav>

      <div className="border-t border-white/10 px-5 py-4">
        {userEmail && (
          <p className="mb-2 truncate text-xs text-sidebar-muted">{userEmail}</p>
        )}
        <LogoutButton label={logoutLabel} className="w-full" />
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: siempre visible */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 md:block">
        {content}
      </aside>

      {/* Mobile: hamburger button + sliding panel */}
      <div className="fixed top-3 left-3 z-40 md:hidden">
        {!mobileOpen && (
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
            className="rounded-md border bg-card p-2"
          >
            <Menu className="size-5" />
          </button>
        )}
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute top-0 left-0 h-full w-64 shadow-lg">{content}</aside>
        </div>
      )}
    </>
  );
}
