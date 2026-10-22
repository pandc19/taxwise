'use client';

import { cn } from 'cn';
import { Link, usePathname } from '@/i18n/navigation';

interface Tab {
  href: string;
  label: string;
}

/** Section tabs for one taxpayer. Periods stays active inside a period. */
export function TaxpayerTabs({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();

  return (
    <nav className="-mb-px flex gap-6 text-sm" aria-label="Contribuyente">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'border-b-2 py-3 transition-colors',
              active
                ? 'border-primary font-semibold text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
