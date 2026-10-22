'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { changeSupplierRule, reconfirmStaleRules, revokeSupplierRule } from './actions';
import type { Relevance, RuleSource } from '@prisma/client';

interface RuleRow {
  id: string;
  supplierRuc: string;
  supplierName: string;
  relevance: Relevance;
  source: RuleSource;
  summary: string | null;
  reasoning: string | null;
  confidence: string | null;
  stale: boolean;
}

export function SuppliersClient({ taxpayerId, rules }: { taxpayerId: string; rules: RuleRow[] }) {
  const t = useTranslations('Proveedores');
  const conc = useTranslations('Conciliacion');
  const [isPending, startTransition] = useTransition();
  const staleCount = rules.filter((r) => r.stale).length;

  function revoke(id: string) {
    if (!window.confirm(t('revokeConfirm'))) return;
    startTransition(() => revokeSupplierRule(taxpayerId, id));
  }

  if (rules.length === 0) {
    return <p className="text-muted-foreground">{t('empty')}</p>;
  }

  return (
    <div className="space-y-4">
      {staleCount > 0 && (
        <Alert className="border-primary">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{t('staleHint', { count: staleCount })}</span>
            <Button
              size="sm"
              disabled={isPending}
              onClick={() => startTransition(() => reconfirmStaleRules(taxpayerId))}
            >
              {t('reconfirmAll')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{conc('supplier')}</TableHead>
              <TableHead>{conc('ruc')}</TableHead>
              <TableHead>{t('rule')}</TableHead>
              <TableHead>{t('status')}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{r.supplierName}</div>
                  {r.summary && <div className="text-xs text-muted-foreground">{r.summary}</div>}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{r.supplierRuc}</TableCell>
                <TableCell>
                  <Select
                    value={r.relevance}
                    disabled={isPending}
                    onValueChange={(v) =>
                      startTransition(() => changeSupplierRule(taxpayerId, r.id, v as Relevance))
                    }
                  >
                    <SelectTrigger className="w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RELATED">{t('related')}</SelectItem>
                      <SelectItem value="NOT_RELATED">{t('notRelated')}</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className="mr-1"
                    title={r.source === 'AI' ? (r.reasoning ?? t('sourceAiHint')) : t('sourceUserHint')}
                  >
                    {r.source === 'AI'
                      ? `${t('sourceAi')}${r.confidence ? ` ${Math.round(parseFloat(r.confidence) * 100)}%` : ''}`
                      : t('sourceUser')}
                  </Badge>
                  {r.stale ? (
                    <Badge variant="outline" title={t('staleTitle')}>
                      {t('stale')}
                    </Badge>
                  ) : (
                    <Badge variant="default">{t('current')}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title={t('revoke')}
                    aria-label={t('revoke')}
                    disabled={isPending}
                    onClick={() => revoke(r.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
