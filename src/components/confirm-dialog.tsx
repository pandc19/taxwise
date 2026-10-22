'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ConfirmOptions {
  message: string;
  /** Label of the confirming button. Defaults to "Confirmar". */
  confirmLabel?: string;
  /** Styles the confirming button as destructive (deletes). */
  destructive?: boolean;
}

/**
 * In-app replacement for window.confirm. Render `dialog` once in the
 * component, then `if (!(await confirm({ message }))) return;`.
 */
export function useConfirm() {
  const common = useTranslations('Common');
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function settle(ok: boolean) {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  }

  const dialog = (
    <Dialog open={options !== null} onOpenChange={(open) => !open && settle(false)}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{options?.confirmLabel ?? common('confirm')}</DialogTitle>
          <DialogDescription>{options?.message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => settle(false)}>
            {common('cancel')}
          </Button>
          <Button
            variant={options?.destructive ? 'destructive' : 'default'}
            onClick={() => settle(true)}
          >
            {options?.confirmLabel ?? common('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { confirm, dialog };
}
