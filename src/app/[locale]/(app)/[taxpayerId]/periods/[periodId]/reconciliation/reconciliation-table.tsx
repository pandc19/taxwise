'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, RefreshCw, Sparkles } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { classifyPeriod, applyManualClassification } from './actions';
import type { ClassificationSourceType, IvaCategory, ProcessingStatus } from '@prisma/client';

interface PurchaseRow {
  id: string;
  supplierRuc: string;
  supplierName: string;
  total: string;
  ivaCategory: IvaCategory;
  processingStatus: ProcessingStatus;
  classificationSource: ClassificationSourceType | null;
  hasVat: boolean;
  issueDate: string;
  series: string;
  aiNote: { confidence: string; reasoning: string; modelId: string } | null;
  supplierProfile: { summary: string; kinds: string[]; mixedUse: boolean; unknown: boolean } | null;
}

type Tab = 'UNCLASSIFIED' | 'CREDIT' | 'COST_EXPENSE' | 'NON_DEDUCTIBLE' | 'PENDING' | 'NO_VAT';

// Who decided a voucher's category: the AI, the user (by hand), or a rule
// the user's earlier manual decision created (ADR-006).
const SOURCE_KEYS: Partial<Record<ClassificationSourceType, 'sourceAi' | 'sourceUser' | 'sourceRule' | 'sourceCatalog' | 'sourceDeterministic'>> = {
  DETERMINISTIC: 'sourceDeterministic',
  AI: 'sourceAi',
  USER: 'sourceUser',
  RULE: 'sourceRule',
  CATALOG: 'sourceCatalog',
};

const TAB_HINT_KEYS: Record<Exclude<Tab, 'NO_VAT'>, 'tabUnclassifiedHint' | 'tabWithCreditHint' | 'tabCostExpenseHint' | 'tabNonDeductibleHint' | 'tabPendingHint'> = {
  UNCLASSIFIED: 'tabUnclassifiedHint',
  CREDIT: 'tabWithCreditHint',
  COST_EXPENSE: 'tabCostExpenseHint',
  NON_DEDUCTIBLE: 'tabNonDeductibleHint',
  PENDING: 'tabPendingHint',
};

export function ReconciliationTable({
  purchases,
  taxpayerId,
  periodId,
}: {
  purchases: PurchaseRow[];
  taxpayerId: string;
  periodId: string;
}) {
  const t = useTranslations('Conciliacion');
  const common = useTranslations('Common');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [applyToSupplier, setApplyToSupplier] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Vouchers without IVA never enter classification (CLAUDE.md), so they
  // are left out of every tab and only counted in a note.
  const noVat = purchases.filter((p) => !p.hasVat);
  const unclassified = purchases.filter(
    (p) => p.hasVat && p.processingStatus === 'UNCLASSIFIED'
  );
  const withCredit = purchases.filter((p) => p.ivaCategory === 'CREDIT');
  const costExpense = purchases.filter((p) => p.ivaCategory === 'COST_EXPENSE');
  const nonDeductible = purchases.filter((p) => p.ivaCategory === 'NON_DEDUCTIBLE');
  const pending = purchases.filter((p) => p.processingStatus === 'REQUIRES_MANUAL_REVIEW');

  // Open on the first tab that has something, not on an empty one: an
  // empty "Pendientes" read as "everything is classified".
  const [tab, setTab] = useState<Tab>(() =>
    unclassified.length > 0
      ? 'UNCLASSIFIED'
      : pending.length > 0
        ? 'PENDING'
        : withCredit.length > 0
          ? 'CREDIT'
          : costExpense.length > 0
            ? 'COST_EXPENSE'
            : nonDeductible.length > 0
              ? 'NON_DEDUCTIBLE'
              : 'UNCLASSIFIED'
  );

  const visible = useMemo(() => {
    if (tab === 'NO_VAT') return noVat;
    if (tab === 'UNCLASSIFIED') return unclassified;
    if (tab === 'CREDIT') return withCredit;
    if (tab === 'COST_EXPENSE') return costExpense;
    if (tab === 'NON_DEDUCTIBLE') return nonDeductible;
    return pending;
  }, [tab, noVat, unclassified, withCredit, costExpense, nonDeductible, pending]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const [detail, setDetail] = useState<PurchaseRow | null>(null);
  const [aiError, setAiError] = useState<{ count: number; message: string } | null>(null);

  function run(options?: Parameters<typeof classifyPeriod>[2]) {
    setAiError(null);
    startTransition(async () => {
      const result = await classifyPeriod(taxpayerId, periodId, options);
      if (result.aiFailures > 0) {
        setAiError({ count: result.aiFailures, message: result.aiError ?? '' });
      }
    });
  }

  function runCascade() {
    run();
  }

  function reclassifySelected() {
    if (selected.size === 0) return;
    run({ invoiceIds: Array.from(selected) });
    setSelected(new Set());
  }

  function reclassifyAll() {
    if (!window.confirm(t('reclassifyAllConfirm'))) return;
    run({ reclassify: true });
  }

  function applyBulk() {
    if (!bulkAction || selected.size === 0) return;
    startTransition(async () => {
      await applyManualClassification(
        Array.from(selected),
        bulkAction as IvaCategory,
        taxpayerId,
        periodId,
        { applyToSupplier }
      );
      setSelected(new Set());
      setBulkAction('');
      setApplyToSupplier(false);
    });
  }

  return (
    <div className="space-y-6">
      {aiError && (
        <Alert variant="destructive">
          <AlertDescription>
            {t('aiFailed', { count: aiError.count })} {aiError.message}
          </AlertDescription>
        </Alert>
      )}

      {unclassified.length > 0 && (
        <Alert className="border-l-4 border-l-signal">
          <Sparkles className="size-4" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{t('unclassifiedHint', { count: unclassified.length })}</span>
            <Button onClick={runCascade} disabled={isPending}>
              {isPending ? t('classifying') : t('classifyButton')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {withCredit.length + costExpense.length + nonDeductible.length > 0 && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={reclassifyAll} disabled={isPending}>
            <RefreshCw className="size-4" />
            {t('reclassifyAll')}
          </Button>
        </div>
      )}

      <div role="tablist" className="-mb-2 flex gap-5 overflow-x-auto border-b">
        {(
          [
            ['UNCLASSIFIED', t('tabUnclassified'), unclassified.length, t('tabUnclassifiedHint')],
            ['CREDIT', t('tabWithCredit'), withCredit.length, t('tabWithCreditHint')],
            ['COST_EXPENSE', t('tabCostExpense'), costExpense.length, t('tabCostExpenseHint')],
            ['NON_DEDUCTIBLE', t('tabNonDeductible'), nonDeductible.length, t('tabNonDeductibleHint')],
            ['PENDING', t('tabPending'), pending.length, t('tabPendingHint')],
            ['NO_VAT', t('tabNoVat'), noVat.length, t('noVatInfo')],
          ] as const
        ).map(([key, label, count, hint]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            title={hint}
            onClick={() => setTab(key)}
            className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 py-2.5 text-sm transition-colors ${
              tab === key
                ? 'border-primary font-semibold text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
            <span
              className={`rounded-sm px-1.5 text-xs tabular-nums ${
                key === 'PENDING' && count > 0
                  ? 'bg-signal text-signal-foreground'
                  : 'bg-secondary text-secondary-foreground'
              }`}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      {tab !== 'NO_VAT' && (
        <p className="text-sm text-muted-foreground">{t(TAB_HINT_KEYS[tab])}</p>
      )}

      {tab === 'NO_VAT' ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('noVatInfo')}</p>
          {noVat.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">{t('emptyState')}</p>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('date')}</TableHead>
                    <TableHead>{t('supplier')}</TableHead>
                    <TableHead>{t('ruc')}</TableHead>
                    <TableHead>{t('series')}</TableHead>
                    <TableHead className="text-right">{t('total')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {noVat.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        {new Date(p.issueDate).toLocaleDateString('es-EC', { timeZone: 'UTC' })}
                      </TableCell>
                      <TableCell className="max-w-64 truncate font-medium">{p.supplierName}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{p.supplierRuc}</TableCell>
                      <TableCell>{p.series}</TableCell>
                      <TableCell className="amount">{p.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      ) : (
        <>
      {tab === 'PENDING' && pending.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>{t('pendingHint')}</span>
          <Button variant="outline" size="sm" onClick={runCascade} disabled={isPending}>
            {isPending ? t('classifying') : t('retryClassify')}
          </Button>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-foreground/25 py-10 text-center text-muted-foreground">
          {tab === 'UNCLASSIFIED' && purchases.length > 0 && pending.length + withCredit.length + costExpense.length + nonDeductible.length === 0
            ? t('nothingClassifiedYet')
            : t('emptyState')}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="flex flex-wrap items-center gap-3 border-b bg-secondary/60 px-4 py-3">
            <Checkbox
              checked={selected.size === visible.length && visible.length > 0}
              onCheckedChange={(checked) =>
                setSelected(checked ? new Set(visible.map((p) => p.id)) : new Set())
              }
            />
            <span className="text-sm">{t('selectAll')}</span>
            <span className="text-sm text-muted-foreground">{t('bulkAction')}:</span>
            <Select value={bulkAction} onValueChange={setBulkAction}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder={t('classifyAs')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CREDIT">{t('withCredit')}</SelectItem>
                <SelectItem value="COST_EXPENSE">{t('costOrExpense')}</SelectItem>
                <SelectItem value="NON_DEDUCTIBLE">{t('nonDeductible')}</SelectItem>
              </SelectContent>
            </Select>
            <label className="flex items-center gap-1.5 text-sm" title={t('applyToSupplierHint')}>
              <Checkbox
                checked={applyToSupplier}
                onCheckedChange={(checked) => setApplyToSupplier(checked === true)}
              />
              {t('applyToSupplier')}
            </label>
            <Button size="sm" onClick={applyBulk} disabled={isPending || selected.size === 0}>
              {common('confirm')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={reclassifySelected}
              disabled={isPending || selected.size === 0}
            >
              <RefreshCw className="size-4" />
              {t('reclassifySelected')}
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>{t('supplier')}</TableHead>
                <TableHead>{t('ruc')}</TableHead>
                <TableHead className="text-right">{t('total')}</TableHead>
                <TableHead>{t('classification')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                  </TableCell>
                  <TableCell className="max-w-64 truncate font-medium">{p.supplierName}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{p.supplierRuc}</TableCell>
                  <TableCell className="amount">{p.total}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant={p.ivaCategory === 'UNCLASSIFIED' ? 'outline' : 'default'}>
                      {p.ivaCategory === 'CREDIT'
                        ? t('withCredit')
                        : p.ivaCategory === 'COST_EXPENSE'
                          ? t('costOrExpense')
                          : p.ivaCategory === 'NON_DEDUCTIBLE'
                            ? t('nonDeductible')
                            : p.processingStatus === 'REQUIRES_MANUAL_REVIEW'
                            ? t('tabPending')
                            : t('tabUnclassified')}
                    </Badge>
                    {p.classificationSource && SOURCE_KEYS[p.classificationSource] && p.ivaCategory !== 'UNCLASSIFIED' && (
                      <Badge
                        variant="outline"
                        className="ml-1"
                        title={t(`${SOURCE_KEYS[p.classificationSource]!}Hint`)}
                      >
                        {t(SOURCE_KEYS[p.classificationSource]!)}
                      </Badge>
                    )}
                    {(p.aiNote || p.supplierProfile) && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title={t('aiDetailTitle')}
                        aria-label={t('aiDetailTitle')}
                        onClick={() => setDetail(p)}
                      >
                        <Info className="size-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

        </>
      )}

      <Button asChild>
        <Link href={`/${taxpayerId}/periods/${periodId}/pre-filing`}>{t('continueToPreDeclaration')}</Link>
      </Button>

      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('aiDetailTitle')}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <p className="font-medium">
                {detail.supplierName} · {detail.supplierRuc}
              </p>
              {detail.supplierProfile && (
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{t('supplierProfileHeading')}</p>
                  <p>{detail.supplierProfile.summary}</p>
                  {detail.supplierProfile.unknown ? (
                    <p className="text-muted-foreground">{t('unknownSupplierNotice')}</p>
                  ) : (
                    detail.supplierProfile.mixedUse && (
                      <p className="text-muted-foreground">{t('mixedUseNotice')}</p>
                    )
                  )}
                </div>
              )}
              {detail.aiNote ? (
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{t('relevanceHeading')}</p>
                  <p className="text-muted-foreground">
                    {t('aiConfidence')}: {Math.round(parseFloat(detail.aiNote.confidence) * 100)}% ·{' '}
                    {detail.aiNote.modelId}
                  </p>
                  <p className="whitespace-pre-line">{detail.aiNote.reasoning}</p>
                  <p className="text-xs text-muted-foreground">{t('aiDetailFootnote')}</p>
                </div>
              ) : (
                !detail.supplierProfile?.mixedUse && !detail.supplierProfile?.unknown && (
                  <p className="text-muted-foreground">{t('noAiAnswer')}</p>
                )
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
