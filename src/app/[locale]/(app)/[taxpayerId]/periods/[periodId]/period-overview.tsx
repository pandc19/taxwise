import { Upload, Receipt, ListChecks, FileCheck } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

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
      <h2 className="mb-4 text-lg font-semibold">{labels.heading}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {steps.map((step, i) => (
          <Link key={step.key} href={step.href}>
            <Card
              className={
                i === 0 && !hasData
                  ? 'h-full border-primary transition-colors hover:border-primary hover:bg-accent'
                  : 'h-full transition-colors hover:border-primary hover:bg-accent'
              }
            >
              <CardHeader>
                <step.Icon className="mb-2 size-6 text-primary" />
                <CardTitle className="flex items-center gap-2 text-base">
                  {i + 1}. {step.title}
                  {i === 0 && !hasData && (
                    <span className="text-xs font-normal text-primary">{labels.startHere}</span>
                  )}
                </CardTitle>
                <CardDescription>{step.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
