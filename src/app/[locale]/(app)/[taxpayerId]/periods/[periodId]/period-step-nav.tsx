'use client';

import { cn } from 'cn';
import { Link, usePathname } from '@/i18n/navigation';

const STEPS = ['ingestion', 'sales', 'reconciliation', 'pre-filing'] as const;

type PeriodStep = (typeof STEPS)[number];

/**
 * The step rail for the four period screens. Rendered once by the period
 * layout; it derives the current step from the URL and hides itself on
 * the period's landing page, where the overview is the navigation.
 * Steps before the current one read as done, the rest as ahead.
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
    <nav aria-label={labels.overview} className="mb-8 overflow-x-auto">
      <ol className="flex min-w-max gap-2">
        {STEPS.map((step, i) => {
          const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'ahead';
          return (
            <li key={step} className="flex-1">
              <Link
                href={`${base}/${step}`}
                aria-current={state === 'current' ? 'step' : undefined}
                className="group block"
              >
                <span
                  className={cn(
                    'block h-1 rounded-full transition-colors',
                    state === 'ahead' ? 'bg-border group-hover:bg-foreground/30' : 'bg-primary'
                  )}
                />
                <span
                  className={cn(
                    'mt-2 block whitespace-nowrap pr-4 text-sm',
                    state === 'current' && 'font-semibold text-foreground',
                    state === 'done' && 'text-foreground/80',
                    state === 'ahead' && 'text-muted-foreground'
                  )}
                >
                  <span className="tabular-nums">{i + 1}.</span> {labels[step]}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
