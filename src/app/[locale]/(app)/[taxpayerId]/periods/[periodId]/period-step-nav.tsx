'use client';

import { cn } from 'cn';
import { Check } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';

const STEPS = ['ingestion', 'sales', 'reconciliation', 'pre-filing'] as const;

type PeriodStep = (typeof STEPS)[number];

/**
 * The step tracker for the four period screens, rendered once by the
 * period layout. It derives the current step from the URL and hides
 * itself on the period's landing page, where the overview is the
 * navigation. Steps before the current one read as done (check mark),
 * the current one is filled, the rest are outlined.
 */
export function PeriodStepNav({
  taxpayerId,
  periodId,
  labels,
}: {
  taxpayerId: string;
  periodId: string;
  labels: Record<PeriodStep, string> & { overview: string };
}) {
  const pathname = usePathname();
  const base = `/${taxpayerId}/periods/${periodId}`;
  if (pathname === base) return null;

  const current = pathname.slice(base.length + 1).split('/')[0];
  const currentIndex = STEPS.indexOf(current as PeriodStep);

  return (
    <nav aria-label={labels.overview} className="max-w-full overflow-x-auto">
      <ol className="flex min-w-max overflow-hidden rounded-md border bg-card text-sm">
        {STEPS.map((step, i) => {
          const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'ahead';
          return (
            <li key={step} className="border-l first:border-l-0">
              <Link
                href={`${base}/${step}`}
                aria-current={state === 'current' ? 'step' : undefined}
                className={cn(
                  'flex h-8 items-center gap-2 px-3 whitespace-nowrap transition-colors',
                  state === 'current' && 'bg-primary font-medium text-primary-foreground',
                  state === 'done' && 'text-foreground hover:bg-accent',
                  state === 'ahead' && 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                {state === 'done' ? (
                  <Check aria-hidden className="size-3.5 text-success" />
                ) : (
                  <span className="tabular-nums opacity-70">{i + 1}</span>
                )}
                {labels[step]}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
