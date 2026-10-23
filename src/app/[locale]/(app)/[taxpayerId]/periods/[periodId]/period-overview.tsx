import { ChevronRight, Upload, Receipt, ListChecks, FileCheck } from 'lucide-react';
import { Link } from '@/i18n/navigation';

interface StepCard {
  key: 'ingestion' | 'sales' | 'reconciliation' | 'pre-filing';
  href: string;
  title: string;
  description: string;
  Icon: typeof Upload;
}

/**
 * The period's landing page: one card per step, always. Pre-declaración
 * is only the last of the four, so landing on it directly (as before)
 * hid the other steps; the cards flag the first step only while the
 * period has no comprobantes yet.
 */
export function PeriodOverview({
  taxpayerId,
  periodId,
  hasData,
  labels,
}: {
  taxpayerId: string;
  periodId: string;
  hasData: boolean;
  labels: {
    heading: string;
    ingestionTitle: string;
    ingestionDescription: string;
    salesTitle: string;
    salesDescription: string;
    reconciliationTitle: string;
    reconciliationDescription: string;
    preFilingTitle: string;
    preFilingDescription: string;
    startHere: string;
  };
}) {
  const base = `/${taxpayerId}/periods/${periodId}`;
  const steps: StepCard[] = [
    {
      key: 'ingestion',
      href: `${base}/ingestion`,
      title: labels.ingestionTitle,
      description: labels.ingestionDescription,
      Icon: Upload,
    },
    {
      key: 'sales',
      href: `${base}/sales`,
      title: labels.salesTitle,
      description: labels.salesDescription,
      Icon: Receipt,
    },
    {
      key: 'reconciliation',
      href: `${base}/reconciliation`,
      title: labels.reconciliationTitle,
      description: labels.reconciliationDescription,
      Icon: ListChecks,
    },
    {
      key: 'pre-filing',
      href: `${base}/pre-filing`,
      title: labels.preFilingTitle,
      description: labels.preFilingDescription,
      Icon: FileCheck,
    },
  ];

  return (
    <div>
      <h2 className="mb-2 text-sm font-medium text-muted-foreground">{labels.heading}</h2>
      <ol className="settle divide-y divide-border overflow-hidden rounded-md border bg-card">
        {steps.map((step, i) => {
          const highlight = i === 0 && !hasData;
          return (
            <li key={step.key}>
              <Link
                href={step.href}
                className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent/60"
              >
                <span
                  className={
                    highlight
                      ? 'flex size-8 shrink-0 items-center justify-center rounded-md bg-signal text-signal-foreground'
                      : 'flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground'
                  }
                >
                  <step.Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2 font-semibold">
                    <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
                    {step.title}
                    {highlight && (
                      <span className="rounded-sm bg-signal px-1.5 py-0.5 text-xs font-medium text-signal-foreground">
                        {labels.startHere}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{step.description}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
