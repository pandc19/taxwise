'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { useConfirm } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { removeSourceFile } from './actions';

export function RemoveFileButton({
  sourceFileId,
  taxpayerId,
  periodId,
  importedCount,
}: {
  sourceFileId: string;
  taxpayerId: string;
  periodId: string;
  importedCount: number;
}) {
  const t = useTranslations('Ingesta');
  const common = useTranslations('Common');
  const { confirm, dialog } = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleClick() {
    if (!(await confirm({ message: t('removeConfirm', { count: importedCount }), confirmLabel: common('delete'), destructive: true }))) return;
    setError(null);
    startTransition(async () => {
      const result = await removeSourceFile(sourceFileId, taxpayerId, periodId);
      if (!result.success) {
        setError(result.error === 'PERIOD_FILED' ? t('removeFiledError') : t('removeError'));
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {dialog}
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button
        variant="ghost"
        size="icon-sm"
        title={common('delete')}
        aria-label={common('delete')}
        disabled={isPending}
        onClick={handleClick}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
